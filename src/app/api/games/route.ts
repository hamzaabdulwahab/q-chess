import { NextRequest, NextResponse } from "next/server";
import { ChessService } from "@/lib/chess-service";
import { getSupabaseServer } from "@/lib/supabase-server";

// Simple in-memory cache for games (in production, use Redis or similar)
interface CacheEntry {
  data: unknown;
  timestamp: number;
  userId: string;
}

const gameCache = new Map<string, CacheEntry>();
const CACHE_TTL = 30 * 1000; // 30 seconds cache

function getCacheKey(userId: string, endpoint: string) {
  return `${endpoint}:${userId}`;
}

function getCachedData(cacheKey: string): unknown | null {
  const entry = gameCache.get(cacheKey);
  if (!entry) return null;
  
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    gameCache.delete(cacheKey);
    return null;
  }
  
  return entry.data;
}

function setCachedData(cacheKey: string, data: unknown, userId: string) {
  gameCache.set(cacheKey, {
    data,
    timestamp: Date.now(),
    userId
  });
  
  // Cleanup old entries periodically
  if (gameCache.size > 1000) {
    const now = Date.now();
    for (const [key, entry] of gameCache.entries()) {
      if (now - entry.timestamp > CACHE_TTL) {
        gameCache.delete(key);
      }
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    // Require authentication for viewing games
    const supabase = getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse pagination parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const includeMoves = searchParams.get('includeMoves') === 'true';
    
    // Validate pagination parameters
    const validPage = Math.max(1, page);
    const validLimit = Math.min(Math.max(1, limit), 100); // Max 100 games per request

    // Create cache key that includes pagination
    const cacheKey = getCacheKey(user.id, `games:${validPage}:${validLimit}:${includeMoves}`);
    const cachedGames = getCachedData(cacheKey);
    
    if (cachedGames) {
      const response = NextResponse.json(cachedGames);
      response.headers.set('X-Cache', 'HIT');
      return response;
    }

    // Get games with pagination
    let result;
    if (includeMoves) {
      const games = await ChessService.getUserGames(user.id);
      // Apply in-memory pagination for full games (since they're cached)
      const startIndex = (validPage - 1) * validLimit;
      const endIndex = startIndex + validLimit;
      const paginatedGames = games.slice(startIndex, endIndex);
      
      result = {
        games: paginatedGames,
        pagination: {
          page: validPage,
          limit: validLimit,
          total: games.length,
          totalPages: Math.ceil(games.length / validLimit),
          hasNext: endIndex < games.length,
          hasPrev: validPage > 1
        }
      };
    } else {
      // Use database-level pagination for lightweight queries
      const { games, total } = await ChessService.getUserGamesLight(user.id, validPage, validLimit);
      
      result = {
        games,
        pagination: {
          page: validPage,
          limit: validLimit,
          total,
          totalPages: Math.ceil(total / validLimit),
          hasNext: (validPage * validLimit) < total,
          hasPrev: validPage > 1
        }
      };
    }
    
    // Cache the result
    setCachedData(cacheKey, result, user.id);
    
    const response = NextResponse.json(result);
    response.headers.set('X-Cache', 'MISS');
    response.headers.set('Cache-Control', 'private, max-age=30');
    return response;
  } catch (error) {
    console.error("Error fetching games:", error);
    return NextResponse.json(
      { error: "Failed to fetch games" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    // Require auth for creating games
    const supabase = getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const gameId = await ChessService.createNewGame();
    
    // Invalidate cache after creating a new game
    const cacheKey = getCacheKey(user.id, 'games');
    gameCache.delete(cacheKey);
    
    return NextResponse.json({ gameId });
  } catch (error) {
    console.error("Error creating game:", error);
    return NextResponse.json(
      { error: "Failed to create game" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Require auth for deletions
    const supabase = getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get("id");
    const all = searchParams.get("all");

    if (all === "true") {
      // Delete all games
      const deletedCount = await ChessService.deleteAllGames();
      
      // Invalidate cache after deleting all games
      const cacheKey = getCacheKey(user.id, 'games');
      gameCache.delete(cacheKey);
      
      return NextResponse.json({
        success: true,
        message: `Deleted ${deletedCount} games`,
      });
    }

    if (!gameId) {
      return NextResponse.json(
        { error: "Game ID is required" },
        { status: 400 }
      );
    }

    const success = await ChessService.deleteGame(parseInt(gameId));

    if (success) {
      // Invalidate cache after deleting a game
      const cacheKey = getCacheKey(user.id, 'games');
      gameCache.delete(cacheKey);
      
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }
  } catch (error) {
    console.error("Error deleting game:", error);
    return NextResponse.json(
      { error: "Failed to delete game" },
      { status: 500 }
    );
  }
}

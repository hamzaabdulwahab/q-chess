import { NextRequest, NextResponse } from "next/server";
import { ChessService } from "@/lib/chess-service";
import { getSupabaseServer } from "@/lib/supabase-server";

// Note: Removed in-memory caching to prevent stale archives after moves
function getCacheKey(userId: string, endpoint: string) {
  return `${endpoint}:${userId}`;
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
    
  const response = NextResponse.json(result);
  // Always serve latest list
  response.headers.set('Cache-Control', 'no-store');
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
    
    const gameId = await ChessService.createNewGame(user.id);
    
    // Defensive: if any in-memory cache existed, clear per-user games prefixes
    try {
      // @ts-expect-error: legacy in-memory cache may not exist at runtime
      if (typeof gameCache !== 'undefined') {
        const prefix = getCacheKey(user.id, 'games');
        // @ts-expect-error: keys() may not exist on legacy cache shim
        for (const key of Array.from(gameCache.keys?.() ?? []) as string[]) {
          if ((key as string).startsWith(prefix)) {
            // @ts-expect-error: delete on legacy cache shim
            gameCache.delete(key);
          }
        }
      }
    } catch {}
    
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
      
      // Defensive cache clear
      try {
        // @ts-expect-error: legacy in-memory cache may not exist at runtime
        if (typeof gameCache !== 'undefined') {
          const prefix = getCacheKey(user.id, 'games');
          // @ts-expect-error: keys() may not exist on legacy cache shim
          for (const key of Array.from(gameCache.keys?.() ?? []) as string[]) {
            if ((key as string).startsWith(prefix)) {
              // @ts-expect-error: delete on legacy cache shim
              gameCache.delete(key);
            }
          }
        }
      } catch {}
      
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
      // Defensive cache clear
      try {
        // @ts-expect-error: legacy in-memory cache may not exist at runtime
        if (typeof gameCache !== 'undefined') {
          const prefix = getCacheKey(user.id, 'games');
          // @ts-expect-error: keys() may not exist on legacy cache shim
          for (const key of Array.from(gameCache.keys?.() ?? []) as string[]) {
            if ((key as string).startsWith(prefix)) {
              // @ts-expect-error: delete on legacy cache shim
              gameCache.delete(key);
            }
          }
        }
      } catch {}
      
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

import { NextRequest, NextResponse } from "next/server";
import { ChessService } from "@/lib/chess-service";
import { getSupabaseServer } from "@/lib/supabase-server";

// Simple in-memory cache for individual games
interface GameCacheEntry {
  data: unknown;
  timestamp: number;
}

const gameCache = new Map<string, GameCacheEntry>();
const CACHE_TTL = 15 * 1000; // 15 seconds cache for individual games

function getGameCacheKey(gameId: number) {
  return `game:${gameId}`;
}

function getCachedGame(cacheKey: string): unknown | null {
  const entry = gameCache.get(cacheKey);
  if (!entry) return null;
  
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    gameCache.delete(cacheKey);
    return null;
  }
  
  return entry.data;
}

function setCachedGame(cacheKey: string, data: unknown) {
  gameCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });
  
  // Cleanup old entries periodically
  if (gameCache.size > 500) {
    const now = Date.now();
    for (const [key, entry] of gameCache.entries()) {
      if (now - entry.timestamp > CACHE_TTL) {
        gameCache.delete(key);
      }
    }
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const gameIdStr = resolvedParams.id;

    // Validate that the ID is a valid number
    if (
      !gameIdStr ||
      gameIdStr === "undefined" ||
      gameIdStr === "null" ||
      gameIdStr === "NaN"
    ) {
      return NextResponse.json({ error: "Invalid game ID" }, { status: 400 });
    }

    const gameId = parseInt(gameIdStr);

    if (isNaN(gameId) || gameId <= 0) {
      return NextResponse.json({ error: "Invalid game ID" }, { status: 400 });
    }

    // Check cache first
    const cacheKey = getGameCacheKey(gameId);
    const cachedGame = getCachedGame(cacheKey);
    
    if (cachedGame) {
      const response = NextResponse.json({ game: cachedGame });
      response.headers.set('X-Cache', 'HIT');
      return response;
    }

    const game = await ChessService.getGame(gameId);

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // Cache the result
    setCachedGame(cacheKey, game);

    const response = NextResponse.json({ game });
    response.headers.set('X-Cache', 'MISS');
    response.headers.set('Cache-Control', 'private, max-age=15');
    return response;
  } catch (error) {
    console.error("Error fetching game:", error);
    return NextResponse.json(
      { error: "Failed to fetch game" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require auth for making moves
    const supabase = getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const resolvedParams = await params;
    const gameIdStr = resolvedParams.id;

    // Validate that the ID is a valid number
    if (
      !gameIdStr ||
      gameIdStr === "undefined" ||
      gameIdStr === "null" ||
      gameIdStr === "NaN"
    ) {
      return NextResponse.json({ error: "Invalid game ID" }, { status: 400 });
    }

    const gameId = parseInt(gameIdStr);

    if (isNaN(gameId) || gameId <= 0) {
      return NextResponse.json({ error: "Invalid game ID" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const { from, to, promotion, clientMoveId, expectedPly, prevFen, san } =
      body as {
        from?: string;
        to?: string;
        promotion?: string;
        clientMoveId?: string;
        expectedPly?: number;
        prevFen?: string;
        san?: string;
      };

    if (!from || !to) {
      return NextResponse.json(
        { error: "From and to squares are required" },
        { status: 400 }
      );
    }

    // Get current game state
    const game = await ChessService.getGame(gameId);
    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // Create chess service instance with current position
    const currentFen = (game as unknown as { fen: string }).fen;
    const chessService = new ChessService(currentFen);

    // Optional idempotency/ordering checks
    if (typeof expectedPly === "number") {
      const currentHistoryLen = chessService.chess.history().length;
      if (currentHistoryLen !== expectedPly - 1) {
        return NextResponse.json(
          {
            error: `Move order conflict: expected ply ${
              expectedPly - 1
            }, found ${currentHistoryLen}`,
          },
          { status: 409 }
        );
      }
    }
    if (prevFen && prevFen.trim() !== currentFen.trim()) {
      return NextResponse.json(
        { error: "Position conflict: stale client state" },
        { status: 409 }
      );
    }

    // Make the move
    const result = await chessService.makeMove(gameId, from, to, promotion);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Invalidate cache after making a move
    const cacheKey = getGameCacheKey(gameId);
    gameCache.delete(cacheKey);

    return NextResponse.json({
      ...result,
      clientMoveId: clientMoveId ?? null,
      san: result.san ?? san,
    });
  } catch (error) {
    console.error("Error making move:", error);
    return NextResponse.json({ error: "Failed to make move" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require auth to update game state
    const supabase = getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const gameIdStr = resolvedParams.id;
    if (!gameIdStr || isNaN(parseInt(gameIdStr))) {
      return NextResponse.json({ error: "Invalid game ID" }, { status: 400 });
    }
    const gameId = parseInt(gameIdStr);

    const body = await request.json();
    const { status, winner } = body as {
      status?: string;
      winner?: "white" | "black" | "draw" | null;
    };

    if (!status) {
      return NextResponse.json(
        { error: "Status is required" },
        { status: 400 }
      );
    }

    const updatePayload: Record<string, unknown> = {
      status,
      winner: winner ?? null,
    };

    const { error } = await supabase
      .from("games")
      .update(updatePayload)
      .eq("id", gameId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating game:", error);
    return NextResponse.json(
      { error: "Failed to update game" },
      { status: 500 }
    );
  }
}

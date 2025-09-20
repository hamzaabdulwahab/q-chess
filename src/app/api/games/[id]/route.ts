import { NextRequest, NextResponse } from "next/server";
import { ChessService } from "@/lib/chess-service";
import { getSupabaseServer } from "@/lib/supabase-server";

// Note: Removed in-memory caching to guarantee immediate consistency after moves
function getGameCacheKey(gameId: number) {
  return `game:${gameId}`;
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

    // SECURITY: Get authenticated user first
    const supabase = getSupabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // SECURITY: Use authenticated Supabase client to enforce RLS
    const game = await ChessService.getGameForUser(gameId, user.id);

    if (!game) {
      return NextResponse.json({ error: "Game not found or access denied" }, { status: 404 });
    }

    const response = NextResponse.json({ game });
    // Ensure no client/proxy caching; always fresh
    response.headers.set('Cache-Control', 'no-store');
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

    // SECURITY: Get current game state with user validation
    const game = await ChessService.getGameForUser(gameId, user.id);
    if (!game) {
      return NextResponse.json({ error: "Game not found or access denied" }, { status: 404 });
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

    // Invalidate any local caches using this game id (defensive; GET is no-store now)
    try {
      const cachePrefix = getGameCacheKey(gameId);
      // @ts-expect-error: legacy in-memory cache may not exist at runtime
      if (typeof gameCache !== 'undefined') {
        // @ts-expect-error: keys() may not exist on legacy cache shim
        for (const key of Array.from(gameCache.keys?.() ?? []) as string[]) {
          if ((key as string).startsWith(cachePrefix)) {
            // @ts-expect-error: delete on legacy cache shim
            gameCache.delete(key);
          }
        }
      }
    } catch {}

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

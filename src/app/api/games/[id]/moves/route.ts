import { NextRequest, NextResponse } from "next/server";
import { ChessService } from "@/lib/chess-service";
import { getSupabaseServer } from "@/lib/supabase-server";

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

    // SECURITY: Get current game state with user validation
    const game = await ChessService.getGameForUser(gameId, user.id);
    if (!game) {
      return NextResponse.json({ error: "Game not found or access denied" }, { status: 404 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const square = searchParams.get("square");

    // Create chess service instance with current position
    const chessService = new ChessService(
      (game as unknown as { fen: string }).fen
    );

    if (square) {
      // Get possible moves for specific square
      const possibleMoves = chessService.getPossibleMoves(square);
      return NextResponse.json({ possibleMoves });
    } else {
      // Get all legal moves
      const allMoves = chessService.getAllMoves();
      return NextResponse.json({ allMoves });
    }
  } catch (error) {
    console.error("Error getting moves:", error);
    return NextResponse.json({ error: "Failed to get moves" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    const { from, to, promotion, clientMoveId, expectedPly, prevFen } =
      (await request.json().catch(() => ({}))) as {
        from?: string;
        to?: string;
        promotion?: string;
        clientMoveId?: string;
        expectedPly?: number;
        prevFen?: string;
      };

    if (!from || !to) {
      return NextResponse.json(
        { error: "From and to squares are required" },
        { status: 400 },
      );
    }

    // SECURITY: Get current game with user validation
    const game = await ChessService.getGameForUser(gameId, user.id);
    if (!game) {
      return NextResponse.json({ error: "Game not found or access denied" }, { status: 404 });
    }

    const currentFen = (game as unknown as { fen: string }).fen;
    const currentMoveCount = Number(
      (game as unknown as { move_count?: number | null }).move_count ??
        (game as unknown as { totalMoves?: number | null }).totalMoves ??
        0,
    );

    if (typeof expectedPly === "number") {
      const expectedPreviousMoveCount = expectedPly - 1;
      if (currentMoveCount !== expectedPreviousMoveCount) {
        return NextResponse.json(
          {
            error: `Move order conflict: expected ply ${expectedPreviousMoveCount}, found ${currentMoveCount}`,
            clientMoveId: clientMoveId ?? null,
          },
          { status: 409 },
        );
      }
    }

    if (prevFen && prevFen.trim() !== currentFen.trim()) {
      return NextResponse.json(
        {
          error: "Position conflict: stale client state",
          clientMoveId: clientMoveId ?? null,
        },
        { status: 409 },
      );
    }

    // Create chess service instance with current position
    const chessService = new ChessService(currentFen);

    // Make the move
    const result = await chessService.makeMove(
      gameId,
      from,
      to,
      promotion,
      user.id,
      expectedPly,
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        fen: result.fen,
        san: result.san,
        gameStatus: result.gameStatus,
        capturedPiece: result.capturedPiece,
        clientMoveId: clientMoveId ?? null,
      });
    } else {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
  } catch (error) {
    console.error("Error making move:", error);
    return NextResponse.json({ error: "Failed to make move" }, { status: 500 });
  }
}

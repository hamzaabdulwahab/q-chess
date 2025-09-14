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

    // Get current game state
    const game = await ChessService.getGame(gameId);
    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
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

    const { from, to, promotion } = await request.json();

    // Get current game
    const game = await ChessService.getGame(gameId);
    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // Create chess service instance with current position
    const chessService = new ChessService(
      (game as unknown as { fen: string }).fen
    );

    // Make the move
    const result = await chessService.makeMove(gameId, from, to, promotion);

    if (result.success) {
      return NextResponse.json({
        success: true,
        fen: result.fen,
        san: result.san,
        gameStatus: result.gameStatus,
        capturedPiece: result.capturedPiece,
      });
    } else {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
  } catch (error) {
    console.error("Error making move:", error);
    return NextResponse.json({ error: "Failed to make move" }, { status: 500 });
  }
}

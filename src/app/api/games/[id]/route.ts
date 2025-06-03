import { NextRequest, NextResponse } from "next/server";
import { ChessService } from "@/lib/chess-service";

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

    const game = await ChessService.getGame(gameId);

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    return NextResponse.json({ game });
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
    const chessService = new ChessService(game.fen);

    // Make the move
    const result = await chessService.makeMove(gameId, from, to, promotion);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error making move:", error);
    return NextResponse.json({ error: "Failed to make move" }, { status: 500 });
  }
}

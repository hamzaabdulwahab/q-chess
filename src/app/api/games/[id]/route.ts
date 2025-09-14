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
    const chessService = new ChessService(
      (game as unknown as { fen: string }).fen
    );

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

    const { error } = await supabase
      .from("games")
      .update({ status, winner: winner ?? null })
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

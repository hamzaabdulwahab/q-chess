import { NextRequest, NextResponse } from "next/server";
import { ChessService } from "@/lib/chess-service";
import { getSupabaseServer } from "@/lib/supabase-server";

export async function GET() {
  try {
    // Require authentication for viewing games
    const supabase = getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get only the current user's games
    const games = await ChessService.getUserGames(user.id);
    return NextResponse.json({ games });
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

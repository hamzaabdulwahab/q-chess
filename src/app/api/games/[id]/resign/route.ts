import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

type GameRow = {
  id: number;
  status: string;
  white_user_id: string | null;
  black_user_id: string | null;
};

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const gameId = Number(id);
    if (!Number.isFinite(gameId) || gameId <= 0) {
      return NextResponse.json({ error: "Invalid game ID" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("games")
      .select("id, status, white_user_id, black_user_id")
      .eq("id", gameId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const game = data as GameRow | null;
    if (!game) {
      return NextResponse.json(
        { error: "Game not found or access denied" },
        { status: 404 },
      );
    }

    if (game.status !== "active") {
      return NextResponse.json(
        { error: "Game is not active" },
        { status: 400 },
      );
    }

    const isWhite = game.white_user_id === user.id;
    const isBlack = game.black_user_id === user.id;
    if (!isWhite && !isBlack) {
      return NextResponse.json(
        { error: "Only participants can resign" },
        { status: 403 },
      );
    }

    const winner: "white" | "black" = isWhite ? "black" : "white";
    const nowIso = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("games")
      .update({
        status: "resigned",
        winner,
        ended_at: nowIso,
        result_reason: "resignation",
        pending_draw_offer_by: null,
      })
      .eq("id", gameId)
      .eq("status", "active");

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, winner });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to resign";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

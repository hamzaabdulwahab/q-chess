import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

type GameRow = {
  id: number;
  status: string;
  white_user_id: string | null;
  black_user_id: string | null;
  pending_draw_offer_by: string | null;
};

async function loadGame(
  supabase: ReturnType<typeof getSupabaseServer>,
  gameId: number,
): Promise<GameRow | null> {
  const { data, error } = await supabase
    .from("games")
    .select(
      "id, status, white_user_id, black_user_id, pending_draw_offer_by",
    )
    .eq("id", gameId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as GameRow | null) ?? null;
}

function ensureParticipant(game: GameRow, userId: string): void {
  if (game.white_user_id !== userId && game.black_user_id !== userId) {
    throw new Error("FORBIDDEN");
  }
}

// POST = offer a draw. Idempotent: re-offering by the same player is a no-op.
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

    const game = await loadGame(supabase, gameId);
    if (!game) {
      return NextResponse.json(
        { error: "Game not found or access denied" },
        { status: 404 },
      );
    }

    try {
      ensureParticipant(game, user.id);
    } catch {
      return NextResponse.json(
        { error: "Only participants can offer a draw" },
        { status: 403 },
      );
    }

    if (game.status !== "active") {
      return NextResponse.json(
        { error: "Game is not active" },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("games")
      .update({ pending_draw_offer_by: user.id })
      .eq("id", gameId)
      .eq("status", "active");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to offer draw";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH = respond to an offer.  Body: { action: 'accept' | 'decline' | 'cancel' }
//  - accept:  opponent of the offerer accepts; game ends as draw
//  - decline: opponent of the offerer declines; offer cleared
//  - cancel:  the offerer rescinds their own offer
export async function PATCH(
  request: NextRequest,
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

    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
    };
    const action = String(body.action || "").toLowerCase();
    if (action !== "accept" && action !== "decline" && action !== "cancel") {
      return NextResponse.json(
        { error: "Action must be accept, decline, or cancel" },
        { status: 400 },
      );
    }

    const game = await loadGame(supabase, gameId);
    if (!game) {
      return NextResponse.json(
        { error: "Game not found or access denied" },
        { status: 404 },
      );
    }

    try {
      ensureParticipant(game, user.id);
    } catch {
      return NextResponse.json(
        { error: "Only participants can respond to a draw offer" },
        { status: 403 },
      );
    }

    if (game.status !== "active") {
      return NextResponse.json(
        { error: "Game is not active" },
        { status: 400 },
      );
    }
    if (!game.pending_draw_offer_by) {
      return NextResponse.json(
        { error: "No pending draw offer" },
        { status: 400 },
      );
    }

    if (action === "cancel") {
      if (game.pending_draw_offer_by !== user.id) {
        return NextResponse.json(
          { error: "Only the offerer can cancel" },
          { status: 403 },
        );
      }
      const { error } = await supabase
        .from("games")
        .update({ pending_draw_offer_by: null })
        .eq("id", gameId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, status: "cancelled" });
    }

    // accept / decline are responses by the opponent of the offerer
    if (game.pending_draw_offer_by === user.id) {
      return NextResponse.json(
        { error: "Cannot respond to your own offer" },
        { status: 400 },
      );
    }

    if (action === "decline") {
      const { error } = await supabase
        .from("games")
        .update({ pending_draw_offer_by: null })
        .eq("id", gameId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, status: "declined" });
    }

    // accept → end the game as a draw
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("games")
      .update({
        status: "draw",
        winner: "draw",
        pending_draw_offer_by: null,
        ended_at: nowIso,
        result_reason: "draw_agreement",
      })
      .eq("id", gameId)
      .eq("status", "active");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, status: "accepted" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update draw offer";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

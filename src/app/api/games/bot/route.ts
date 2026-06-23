import { NextRequest, NextResponse } from "next/server";
import { Chess } from "chess.js";
import { getSupabaseServer } from "@/lib/supabase-server";
import { ChessService } from "@/lib/chess-service";
import { warmStockfishEngine } from "@/lib/stockfish/engine";
import type { BotColorChoice, BotLevel } from "@/lib/stockfish/types";

// Spawns the Stockfish child process via warmStockfishEngine(), so pin to the
// Node runtime (not Edge) and allow time for the engine boot.
export const runtime = "nodejs";
export const maxDuration = 30;

interface CreateBotGameBody {
  color?: BotColorChoice;
  level?: string;
  timeControlMinutes?: number;
  incrementSeconds?: number;
}

function parseTimeControl(body: CreateBotGameBody): {
  initialMs: number | null;
  incrementMs: number;
} {
  // Bot games are untimed by default. If the client passes a time control,
  // honour it within the same bounds as human games.
  if (body.timeControlMinutes == null) {
    return { initialMs: null, incrementMs: 0 };
  }
  const minutes = Number(body.timeControlMinutes);
  const incrementSeconds = Number(body.incrementSeconds ?? 0);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 30) {
    throw new Error("Time control minutes must be between 1 and 30");
  }
  if (
    !Number.isFinite(incrementSeconds) ||
    incrementSeconds < 0 ||
    incrementSeconds > 30
  ) {
    throw new Error("Increment must be between 0 and 30 seconds");
  }
  return {
    initialMs: Math.floor(minutes * 60 * 1000),
    incrementMs: Math.floor(incrementSeconds * 1000),
  };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Block starting a bot game while the user is already in an active
    // multiplayer game. Bot games themselves are not blocked because
    // they're single-player.
    const activeMultiId = await ChessService.getActiveMultiplayerGameId(
      user.id,
    );
    if (activeMultiId) {
      return NextResponse.json(
        {
          error: `You're already in an active multiplayer game (#${activeMultiId}). Finish or resign it first.`,
        },
        { status: 400 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as CreateBotGameBody;
    void warmStockfishEngine().catch((error) => {
      console.error("[stockfish warmup]", error);
    });

    const colorChoice: BotColorChoice =
      body.color === "white" || body.color === "black"
        ? body.color
        : "random";
    // The UI intentionally exposes only color selection. Always run the
    // strongest practical level internally, regardless of client payload.
    const level: BotLevel = "monster";

    const { initialMs, incrementMs } = parseTimeControl(body);

    const humanColor: "white" | "black" =
      colorChoice === "random"
        ? Math.random() < 0.5
          ? "white"
          : "black"
        : colorChoice;
    const botSide: "white" | "black" =
      humanColor === "white" ? "black" : "white";

    const initialFen = new Chess().fen();
    const nowIso = new Date().toISOString();

    // Use the user-authenticated client. The insert RLS policy
    // (games_insert_own) requires `auth.uid() = user_id` AND one of:
    //   - both white_user_id and black_user_id are null, OR
    //   - auth.uid() is one of them.
    // For a bot game we set user_id = caller and place the caller on
    // exactly one side, leaving the other null. The third branch is
    // satisfied, so no service-role key is needed.
    const { data, error } = await supabase
      .from("games")
      .insert({
        fen: initialFen,
        pgn: null,
        status: "active",
        current_player: "white",
        winner: null,
        move_count: 0,
        user_id: user.id,
        white_user_id: humanColor === "white" ? user.id : null,
        black_user_id: humanColor === "black" ? user.id : null,
        mode: "human_vs_stockfish",
        bot_side: botSide,
        bot_level: level,
        time_control_initial_ms: initialMs,
        increment_ms: incrementMs,
        white_time_left_ms: initialMs,
        black_time_left_ms: initialMs,
        started_at: nowIso,
        last_move_at: nowIso,
      })
      .select("id")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Failed to create bot game" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      gameId: data.id as number,
      humanColor,
      botSide,
      botLevel: level,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create bot game";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

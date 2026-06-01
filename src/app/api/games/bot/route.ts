import { NextRequest, NextResponse } from "next/server";
import { Chess, type Move } from "chess.js";
import { getSupabaseServer } from "@/lib/supabase-server";
import { ChessService } from "@/lib/chess-service";
import {
  searchBestMove,
  warmStockfishEngine,
} from "@/lib/stockfish/engine";
import { getStockfishSearchContext } from "@/lib/stockfish/search-context";
import type { BotColorChoice, BotLevel } from "@/lib/stockfish/types";

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

async function recordOpeningBotMove({
  supabase,
  gameId,
  botSide,
  level,
  initialFen,
}: {
  supabase: ReturnType<typeof getSupabaseServer>;
  gameId: number;
  botSide: "white" | "black";
  level: BotLevel;
  initialFen: string;
}) {
  const chess = new Chess(initialFen);
  const { bestmove, spentMs } = await searchBestMove(
    "startpos",
    level,
    getStockfishSearchContext(chess),
  );
  const from = bestmove.slice(0, 2);
  const to = bestmove.slice(2, 4);
  const promotion = bestmove.length > 4 ? bestmove.slice(4, 5) : undefined;

  let applied: Move | null;
  try {
    applied = chess.move({ from, to, promotion });
  } catch {
    applied = null;
  }
  if (!applied) {
    throw new Error(`Engine returned an illegal opening move: ${bestmove}`);
  }

  const fenAfter = chess.fen();
  const nextPlayer: "white" | "black" =
    chess.turn() === "w" ? "white" : "black";
  const isCheckmate = chess.isCheckmate();
  const gameStatus = isCheckmate
    ? "checkmate"
    : chess.isStalemate()
      ? "stalemate"
      : chess.isDraw()
        ? "draw"
        : "active";
  const winner: "white" | "black" | "draw" | null = isCheckmate
    ? botSide
    : gameStatus === "draw" || gameStatus === "stalemate"
      ? "draw"
      : null;

  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "record_bot_move",
    {
      p_game_id: gameId,
      p_expected_move_count: 0,
      p_player: botSide,
      p_move_notation: applied.san,
      p_fen_before: initialFen,
      p_fen_after: fenAfter,
      p_pgn: chess.pgn(),
      p_captured_piece: applied.captured ?? null,
      p_is_check: chess.inCheck() && !isCheckmate,
      p_is_checkmate: isCheckmate,
      p_is_castling:
        applied.flags.includes("k") || applied.flags.includes("q"),
      p_is_en_passant: applied.flags.includes("e"),
      p_is_promotion: applied.flags.includes("p"),
      p_current_player: nextPlayer,
      p_status: gameStatus,
      p_winner: winner,
      p_uci: bestmove,
    },
  );

  const persisted = rpcResult as
    | { success?: boolean; error?: string; moveNumber?: number }
    | null;
  if (rpcError || !persisted?.success) {
    throw new Error(
      rpcError?.message || persisted?.error || "Failed to record opening move",
    );
  }

  return {
    san: applied.san,
    uci: bestmove,
    from,
    to,
    fen: fenAfter,
    currentPlayer: nextPlayer,
    moveNumber: persisted.moveNumber ?? 1,
    thinkingMs: spentMs,
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
    const warmupPromise = warmStockfishEngine().catch((error) => {
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

    let openingBotMove:
      | Awaited<ReturnType<typeof recordOpeningBotMove>>
      | null = null;

    // If the user plays black, Stockfish moves first before the route
    // returns. That removes the fragile "new game loaded, now wait for
    // a second client request" pause.
    if (botSide === "white") {
      try {
        openingBotMove = await recordOpeningBotMove({
          supabase,
          gameId: data.id as number,
          botSide,
          level,
          initialFen,
        });
      } catch (error) {
        console.error("[stockfish opening move]", error);
        await warmupPromise;
      }
    }

    return NextResponse.json({
      gameId: data.id as number,
      humanColor,
      botSide,
      botLevel: level,
      openingBotMove,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create bot game";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

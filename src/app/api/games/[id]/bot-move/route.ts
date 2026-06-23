import { NextRequest, NextResponse } from "next/server";
import { Chess, type Move } from "chess.js";
import { getSupabaseServer } from "@/lib/supabase-server";
import { searchBestMove } from "@/lib/stockfish/engine";
import { getStockfishSearchContext } from "@/lib/stockfish/search-context";
import { isBotLevel } from "@/lib/stockfish/types";
import { checkBotMoveRateLimit } from "@/lib/stockfish/rate-limit";

// Tell Next.js this is a Node.js (not Edge) function. Stockfish needs
// `child_process` and the WASM build's worker threads.
export const runtime = "nodejs";
// Allow up to 30s; Stockfish search + DB writes well within that.
export const maxDuration = 30;

interface GameRow {
  id: number;
  fen: string;
  pgn: string | null;
  status: string;
  current_player: "white" | "black";
  move_count: number;
  user_id: string | null;
  white_user_id: string | null;
  black_user_id: string | null;
  mode: string;
  bot_side: "white" | "black" | null;
  bot_level: string | null;
  time_control_initial_ms: number | null;
  increment_ms: number;
  white_time_left_ms: number | null;
  black_time_left_ms: number | null;
  last_move_at: string | null;
}

// Tiny opening book: instant, sound, varied replies for the strong tiers in
// the first few plies. Keyed on the space-joined UCI history. Every candidate
// is validated against chess.js before use (and the downstream re-validation
// still applies), so a stale entry can never corrupt a game.
const OPENING_BOOK: Record<string, string[]> = {
  "": ["e2e4", "d2d4", "g1f3", "c2c4"],
  "e2e4": ["e7e5", "c7c5", "e7e6", "c7c6"],
  "d2d4": ["d7d5", "g8f6", "e7e6"],
  "g1f3": ["g8f6", "d7d5", "c7c5"],
  "c2c4": ["e7e5", "g8f6", "c7c5"],
  "e2e4 e7e5": ["g1f3", "f1c4", "b1c3"],
  "e2e4 c7c5": ["g1f3", "b1c3", "c2c3"],
  "e2e4 e7e6": ["d2d4", "g1f3"],
  "e2e4 c7c6": ["d2d4", "b1c3"],
  "d2d4 d7d5": ["c2c4", "g1f3"],
  "d2d4 g8f6": ["c2c4", "g1f3"],
};

function pickOpeningBookMove(fen: string, uciHistory: string[]): string | null {
  const candidates = OPENING_BOOK[uciHistory.join(" ")];
  if (!candidates || candidates.length === 0) return null;
  const legal = candidates.filter((uci) => {
    const test = new Chess(fen);
    try {
      return Boolean(
        test.move({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          promotion: uci.length > 4 ? uci.slice(4, 5) : undefined,
        }),
      );
    } catch {
      return false;
    }
  });
  if (legal.length === 0) return null;
  return legal[Math.floor(Math.random() * legal.length)];
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // ── Auth ────────────────────────────────────────────────────────
    const supabase = getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Per-user rate limit ─────────────────────────────────────────
    const limit = checkBotMoveRateLimit(user.id);
    if (!limit.ok) {
      return NextResponse.json(
        {
          error: "Too many bot move requests. Slow down.",
          retryAfterMs: limit.retryAfterMs,
        },
        { status: 429 },
      );
    }

    // ── Load game with caller's auth so RLS confirms participation ──
    const { id: idStr } = await params;
    const gameId = Number(idStr);
    if (!Number.isFinite(gameId) || gameId <= 0) {
      return NextResponse.json({ error: "Invalid game ID" }, { status: 400 });
    }

    const { data: game, error: gameError } = await supabase
      .from("games")
      .select(
        "id, fen, pgn, status, current_player, move_count, user_id, white_user_id, black_user_id, mode, bot_side, bot_level, time_control_initial_ms, increment_ms, white_time_left_ms, black_time_left_ms, last_move_at",
      )
      .eq("id", gameId)
      .maybeSingle();

    if (gameError) {
      return NextResponse.json({ error: gameError.message }, { status: 500 });
    }
    const row = game as GameRow | null;
    if (!row) {
      return NextResponse.json(
        { error: "Game not found or access denied" },
        { status: 404 },
      );
    }

    // ── Hard rules: only on bot games, only on bot's turn, only active.
    // This is the security wall that stops a human-vs-human game from
    // ever invoking Stockfish (no engine-analysis cheating).
    if (row.mode !== "human_vs_stockfish" || !row.bot_side) {
      return NextResponse.json(
        { error: "This is not a Stockfish game" },
        { status: 400 },
      );
    }
    if (row.status !== "active") {
      return NextResponse.json(
        { error: "Game is not active" },
        { status: 400 },
      );
    }
    if (row.current_player !== row.bot_side) {
      return NextResponse.json(
        { error: "It is not the bot's turn" },
        { status: 409 },
      );
    }

    // ── Re-validate the position. Trust nothing from the client. ────
    const chess = new Chess();
    try {
      chess.load(row.fen);
    } catch {
      return NextResponse.json(
        { error: "Stored game state is invalid" },
        { status: 500 },
      );
    }
    if (chess.isGameOver()) {
      // Defensive: the active flag and engine-game-over should match.
      return NextResponse.json(
        { error: "Position is already terminal" },
        { status: 400 },
      );
    }

    const level = isBotLevel(row.bot_level) ? row.bot_level : "monster";

    // ── Build UCI move history from the moves table so the engine has
    // access to threefold-repetition state. Falls back to FEN-only if
    // the row is old and lacks UCI strings.
    const { data: priorMoves, error: movesError } = await supabase
      .from("moves")
      .select("uci, move_notation")
      .eq("game_id", gameId)
      .order("move_number", { ascending: true });

    if (movesError) {
      return NextResponse.json(
        { error: movesError.message },
        { status: 500 },
      );
    }

    let positionDirective: string;
    const everyMoveHasUci = (priorMoves ?? []).every(
      (m) => typeof m.uci === "string" && m.uci.length >= 4,
    );
    if (everyMoveHasUci && (priorMoves?.length ?? 0) > 0) {
      const uciList = (priorMoves ?? []).map((m) => m.uci as string);
      positionDirective = `startpos moves ${uciList.join(" ")}`;
    } else {
      positionDirective = `fen ${row.fen}`;
    }

    // ── Choose the move ─────────────────────────────────────────────
    // Instant fast paths that skip the engine:
    //   1. Only one legal move — it is forced.
    //   2. A book opening for the strong tiers in the first few plies (only
    //      when we have a real UCI history to key on).
    // Everything else runs a real search so the bot stays strong — we do NOT
    // speculatively instant-play "obvious" recaptures, which can blunder.
    const legalMoves = chess.moves({ verbose: true }) as Move[];
    const forcedMove = legalMoves.length === 1 ? legalMoves[0] : null;
    const bookMove =
      !forcedMove &&
      everyMoveHasUci &&
      (level === "master" || level === "monster")
        ? pickOpeningBookMove(
            row.fen,
            (priorMoves ?? []).map((m) => m.uci as string),
          )
        : null;

    let bestmove: string;
    let spentMs: number;
    if (forcedMove) {
      bestmove = `${forcedMove.from}${forcedMove.to}${forcedMove.promotion ?? ""}`;
      spentMs = 0;
    } else if (bookMove) {
      bestmove = bookMove;
      spentMs = 0;
    } else {
      const result = await searchBestMove(
        positionDirective,
        level,
        getStockfishSearchContext(chess),
      );
      bestmove = result.bestmove;
      spentMs = result.spentMs;
    }

    // ── Validate engine's move against chess.js. Defence in depth: if
    // the engine returns an illegal move (parser bug, position mismatch)
    // we don't corrupt the game.
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
      return NextResponse.json(
        { error: `Engine returned an illegal move: ${bestmove}` },
        { status: 500 },
      );
    }

    const fenBefore = row.fen;
    const fenAfter = chess.fen();
    const pgn = chess.pgn();
    const nextPlayer: "white" | "black" =
      chess.turn() === "w" ? "white" : "black";

    let gameStatus = "active";
    let winner: "white" | "black" | "draw" | null = null;
    if (chess.isCheckmate()) {
      gameStatus = "checkmate";
      winner = row.bot_side;
    } else if (chess.isStalemate()) {
      gameStatus = "stalemate";
      winner = "draw";
    } else if (chess.isDraw()) {
      gameStatus = "draw";
      winner = "draw";
    }

    const moveNumber = row.move_count + 1;
    const capturedPiece = applied.captured ?? null;
    const isCheck = chess.inCheck();
    const isCheckmate = chess.isCheckmate();
    const isCastle =
      applied.flags.includes("k") || applied.flags.includes("q");
    const isEnPassant = applied.flags.includes("e");
    const isPromotion = applied.flags.includes("p");

    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "record_bot_move",
      {
        p_game_id: gameId,
        p_expected_move_count: row.move_count,
        p_player: row.bot_side,
        p_move_notation: applied.san,
        p_fen_before: fenBefore,
        p_fen_after: fenAfter,
        p_pgn: pgn,
        p_captured_piece: capturedPiece,
        p_is_check: isCheck && !isCheckmate,
        p_is_checkmate: isCheckmate,
        p_is_castling: isCastle,
        p_is_en_passant: isEnPassant,
        p_is_promotion: isPromotion,
        p_current_player: nextPlayer,
        p_status: gameStatus,
        p_winner: winner,
        p_uci: bestmove,
      },
    );

    if (rpcError) {
      return NextResponse.json(
        { error: rpcError.message },
        { status: 500 },
      );
    }

    const persisted = rpcResult as
      | {
          success?: boolean;
          error?: string;
          duplicate?: boolean;
          moveNumber?: number;
        }
      | null;

    if (!persisted?.success) {
      const message = persisted?.error || "Failed to record bot move";
      const status =
        message.includes("conflict") ||
        message.includes("turn") ||
        message.includes("active")
          ? 409
          : 500;
      return NextResponse.json(
        { error: message },
        { status },
      );
    }

    return NextResponse.json({
      ok: true,
      san: applied.san,
      uci: bestmove,
      from,
      to,
      promotion: promotion ?? null,
      capturedPiece,
      fen: fenAfter,
      pgn,
      gameStatus,
      winner,
      currentPlayer: nextPlayer,
      moveNumber:
        typeof persisted.moveNumber === "number"
          ? persisted.moveNumber
          : moveNumber,
      thinkingMs: spentMs,
      duplicate: Boolean(persisted.duplicate),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Bot move failed";
    // Always log: when the engine fails in prod we need the stack to
    // diagnose it from runtime logs.
    console.error("[bot-move]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

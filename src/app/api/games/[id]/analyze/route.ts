import { NextRequest, NextResponse } from "next/server";
import { Chess } from "chess.js";
import { getSupabaseServer } from "@/lib/supabase-server";
import { analyzePosition } from "@/lib/stockfish/engine";
import { checkAnalyzeRateLimit } from "@/lib/stockfish/rate-limit";
import {
  classifyMove,
  accuracyFromAvgDeltaEp,
  perfEloFromAccuracy,
  blankClassificationCounts,
} from "@/lib/review/classify";
import { commentForMove } from "@/lib/review/coach";
import { isBookMove } from "@/lib/review/openings";
import type {
  Classification,
  Eval,
  ReviewedMove,
  GameAnalysisResponse,
} from "@/lib/review/types";

// Stockfish requires the node runtime. Fluid Compute supports 300s.
export const runtime = "nodejs";
export const maxDuration = 300;

interface MoveRow {
  move_number: number;
  player: "white" | "black";
  move_notation: string;
  fen_before: string;
  fen_after: string;
  uci: string | null;
}

interface GameRow {
  id: number;
  status: string;
  white_user_id: string | null;
  black_user_id: string | null;
  user_id: string | null;
}

const MOVETIME_MS = Math.max(
  300,
  Number(process.env.STOCKFISH_REVIEW_MOVETIME_MS) || 900,
);

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

    const { id: idStr } = await params;
    const gameId = Number(idStr);
    if (!Number.isFinite(gameId) || gameId <= 0) {
      return NextResponse.json({ error: "Invalid game ID" }, { status: 400 });
    }

    // Confirm the caller can read the game (RLS handles this).
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("id, status, white_user_id, black_user_id, user_id")
      .eq("id", gameId)
      .maybeSingle();
    if (gameError) {
      return NextResponse.json({ error: gameError.message }, { status: 500 });
    }
    const gameRow = game as GameRow | null;
    if (!gameRow) {
      return NextResponse.json(
        { error: "Game not found or access denied" },
        { status: 404 },
      );
    }
    // Review only makes sense for completed games.
    if (gameRow.status === "active") {
      return NextResponse.json(
        { error: "Game is still active — finish it before reviewing." },
        { status: 400 },
      );
    }

    // Idempotency: if we've already analysed this game, return the
    // cached payload immediately (no engine work, no rate-limit cost).
    const cached = await readCachedAnalysis(supabase, gameId);
    if (cached) return NextResponse.json(cached);

    // Apply rate limit only when we're about to do real work.
    const limit = checkAnalyzeRateLimit(user.id);
    if (!limit.ok) {
      return NextResponse.json(
        {
          error: "Too many analyses recently. Try again later.",
          retryAfterMs: limit.retryAfterMs,
        },
        { status: 429 },
      );
    }

    // Load moves in order.
    const { data: movesData, error: movesError } = await supabase
      .from("moves")
      .select("move_number, player, move_notation, fen_before, fen_after, uci")
      .eq("game_id", gameId)
      .order("move_number", { ascending: true });
    if (movesError) {
      return NextResponse.json({ error: movesError.message }, { status: 500 });
    }
    const moves = (movesData ?? []) as MoveRow[];
    if (moves.length === 0) {
      return NextResponse.json(
        { error: "Game has no moves to analyse." },
        { status: 400 },
      );
    }

    // ── Engine pass ────────────────────────────────────────────────
    // For each ply we ask the engine for the best move at `fen_before`.
    // The post-move evaluation is just the next ply's pre-move eval
    // (re-using the engine output saves N searches). The final position
    // gets one extra search for its `evalAfter`.

    const evals: Array<{
      bestMoveUci: string;
      evalCp: number | null;
      evalMate: number | null;
      pvUci: string[];
    }> = [];

    for (const m of moves) {
      const r = await analyzePosition(`fen ${m.fen_before}`, {
        movetimeMs: MOVETIME_MS,
      });
      evals.push({
        bestMoveUci: r.bestMoveUci,
        evalCp: r.evalCp,
        evalMate: r.evalMate,
        pvUci: r.pvUci,
      });
    }

    // One extra search to know evalAfter for the final move.
    const lastMove = moves[moves.length - 1];
    const tail = await analyzePosition(`fen ${lastMove.fen_after}`, {
      movetimeMs: MOVETIME_MS,
    });
    const tailEval: Eval = { cp: tail.evalCp, mate: tail.evalMate };

    // ── Classification + coach copy ────────────────────────────────
    const reviewed: ReviewedMove[] = [];
    const uciPrefix: string[] = [];
    let prevOpponentDeltaEp: number | undefined = undefined;
    const replayChess = new Chess();

    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      const playedUci = m.uci ?? deriveUciFromSan(replayChess, m.move_notation);

      // Apply the move into the replay engine; if it fails (corrupt data)
      // we skip classification for this ply.
      try {
        replayChess.move({
          from: playedUci.slice(0, 2),
          to: playedUci.slice(2, 4),
          promotion:
            playedUci.length > 4 ? (playedUci.slice(4, 5) as "q" | "r" | "b" | "n") : undefined,
        });
      } catch {
        // Replay diverged; reset from fen_after so subsequent SAN→UCI works.
        replayChess.load(m.fen_after);
      }

      const evalBefore: Eval = {
        cp: evals[i].evalCp,
        mate: evals[i].evalMate,
      };
      const evalAfter: Eval =
        i + 1 < moves.length
          ? { cp: evals[i + 1].evalCp, mate: evals[i + 1].evalMate }
          : tailEval;

      const isBook = isBookMove(uciPrefix);

      const { cls, deltaEp } = classifyMove({
        prevEval: evalBefore,
        currentEval: evalAfter,
        bestMoveUci: evals[i].bestMoveUci,
        playedUci,
        player: m.player,
        fenBefore: m.fen_before,
        fenAfter: m.fen_after,
        isBookMove: isBook,
        // v1 approximation: never mark "Great". MultiPV=2 would let us
        // detect only-moves precisely; deferred per plan.
        isOnlyMove: false,
        opponentDeltaEpPrev: prevOpponentDeltaEp,
      });

      // Best-move SAN: re-derive from fenBefore so the coach can speak SAN.
      const bestMoveSan = uciToSan(m.fen_before, evals[i].bestMoveUci);

      const reviewedMove: ReviewedMove = {
        ply: m.move_number,
        fenBefore: m.fen_before,
        fenAfter: m.fen_after,
        san: m.move_notation,
        uci: playedUci,
        player: m.player,
        evalBefore,
        evalAfter,
        bestMoveUci: evals[i].bestMoveUci,
        bestMoveSan,
        classification: cls,
        deltaEp,
        coachComment: "",
        highlight: {
          from: playedUci.slice(0, 2),
          to: playedUci.slice(2, 4),
        },
      };

      // Track this player's drop so the *opponent's* next move can be
      // classed as "Miss" if they fail to exploit it.
      prevOpponentDeltaEp = deltaEp;

      uciPrefix.push(playedUci);
      reviewed.push(reviewedMove);
    }

    // Second pass: fill in coach commentary now that we have neighbours.
    const uciSoFar: string[] = [];
    for (let i = 0; i < reviewed.length; i++) {
      uciSoFar.push(reviewed[i].uci);
      reviewed[i].coachComment = commentForMove(
        reviewed[i],
        i > 0 ? reviewed[i - 1] : null,
        uciSoFar,
      );
    }

    // ── Aggregate per-player accuracy + classification counts ──────
    const countsWhite = blankClassificationCounts();
    const countsBlack = blankClassificationCounts();
    const dropsWhite: number[] = [];
    const dropsBlack: number[] = [];

    for (const r of reviewed) {
      if (r.player === "white") {
        countsWhite[r.classification] += 1;
        dropsWhite.push(r.deltaEp);
      } else {
        countsBlack[r.classification] += 1;
        dropsBlack.push(r.deltaEp);
      }
    }

    const avg = (xs: number[]) =>
      xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

    const accuracyWhite = accuracyFromAvgDeltaEp(avg(dropsWhite));
    const accuracyBlack = accuracyFromAvgDeltaEp(avg(dropsBlack));
    const perfEloWhite = perfEloFromAccuracy(accuracyWhite);
    const perfEloBlack = perfEloFromAccuracy(accuracyBlack);

    // ── Persist (best effort; we still return the response even if
    // the cache write fails, so the user sees their review).
    const moveAnalysisRows = reviewed.map((r) => ({
      game_id: gameId,
      move_number: r.ply,
      eval_cp: r.evalAfter.cp,
      eval_mate: r.evalAfter.mate,
      best_move_uci: r.bestMoveUci,
      best_move_san: r.bestMoveSan,
      classification: r.classification,
      delta_ep: Number(r.deltaEp.toFixed(4)),
      pv_uci: evals[r.ply - 1]?.pvUci.join(" ") ?? null,
    }));
    // Clear any half-written rows from a previous failed run so the
    // upsert/insert below isn't blocked by PK conflicts.
    const { error: deleteMaError } = await supabase
      .from("move_analyses")
      .delete()
      .eq("game_id", gameId);
    if (deleteMaError) {
      console.error("[analyze] delete move_analyses failed:", deleteMaError);
    }
    const { error: maError } = await supabase
      .from("move_analyses")
      .insert(moveAnalysisRows);
    if (maError) {
      console.error("[analyze] move_analyses insert failed:", maError);
    }
    const { error: gaError } = await supabase
      .from("game_analyses")
      .upsert(
        {
          game_id: gameId,
          accuracy_white: Number(accuracyWhite.toFixed(2)),
          accuracy_black: Number(accuracyBlack.toFixed(2)),
          perf_elo_white: perfEloWhite,
          perf_elo_black: perfEloBlack,
          engine_movetime_ms: MOVETIME_MS,
          analyzed_by: user.id,
        },
        { onConflict: "game_id" },
      );
    if (gaError) {
      console.error("[analyze] game_analyses upsert failed:", gaError);
    }

    const response: GameAnalysisResponse = {
      summary: {
        gameId,
        accuracyWhite,
        accuracyBlack,
        perfEloWhite,
        perfEloBlack,
        engineMovetimeMs: MOVETIME_MS,
        analyzedAt: new Date().toISOString(),
        classificationCountsWhite: countsWhite,
        classificationCountsBlack: countsBlack,
      },
      moves: reviewed,
    };
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analyze failed";
    if (process.env.NODE_ENV === "development") {
      console.error("[analyze]", err);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

interface CachedRow {
  game_id: number;
  accuracy_white: number | null;
  accuracy_black: number | null;
  perf_elo_white: number | null;
  perf_elo_black: number | null;
  engine_movetime_ms: number;
  analyzed_at: string;
}

interface CachedMoveRow {
  move_number: number;
  eval_cp: number | null;
  eval_mate: number | null;
  best_move_uci: string;
  best_move_san: string;
  classification: Classification;
  delta_ep: number;
  pv_uci: string | null;
}

async function readCachedAnalysis(
  supabase: ReturnType<typeof getSupabaseServer>,
  gameId: number,
): Promise<GameAnalysisResponse | null> {
  const { data: summary } = await supabase
    .from("game_analyses")
    .select(
      "game_id, accuracy_white, accuracy_black, perf_elo_white, perf_elo_black, engine_movetime_ms, analyzed_at",
    )
    .eq("game_id", gameId)
    .maybeSingle();
  if (!summary) return null;

  const { data: moveAnalyses } = await supabase
    .from("move_analyses")
    .select(
      "move_number, eval_cp, eval_mate, best_move_uci, best_move_san, classification, delta_ep, pv_uci",
    )
    .eq("game_id", gameId)
    .order("move_number", { ascending: true });
  if (!moveAnalyses || moveAnalyses.length === 0) return null;

  const { data: rawMoves } = await supabase
    .from("moves")
    .select("move_number, player, move_notation, fen_before, fen_after, uci")
    .eq("game_id", gameId)
    .order("move_number", { ascending: true });
  if (!rawMoves) return null;

  const moveMap = new Map<number, MoveRow>();
  for (const m of rawMoves as MoveRow[]) moveMap.set(m.move_number, m);

  const countsWhite = blankClassificationCounts();
  const countsBlack = blankClassificationCounts();

  const reviewed: ReviewedMove[] = [];
  let prevEvalAfter: Eval = { cp: 0, mate: null };
  const uciSoFar: string[] = [];

  for (const ma of moveAnalyses as CachedMoveRow[]) {
    const m = moveMap.get(ma.move_number);
    if (!m) continue;
    if (m.player === "white") countsWhite[ma.classification] += 1;
    else countsBlack[ma.classification] += 1;

    const evalAfter: Eval = { cp: ma.eval_cp, mate: ma.eval_mate };
    const playedUci = m.uci ?? "";
    const reviewedMove: ReviewedMove = {
      ply: ma.move_number,
      fenBefore: m.fen_before,
      fenAfter: m.fen_after,
      san: m.move_notation,
      uci: playedUci,
      player: m.player,
      evalBefore: prevEvalAfter,
      evalAfter,
      bestMoveUci: ma.best_move_uci,
      bestMoveSan: ma.best_move_san,
      classification: ma.classification,
      deltaEp: ma.delta_ep,
      coachComment: "",
      highlight: playedUci.length >= 4
        ? { from: playedUci.slice(0, 2), to: playedUci.slice(2, 4) }
        : undefined,
    };
    uciSoFar.push(playedUci);
    reviewedMove.coachComment = commentForMove(
      reviewedMove,
      reviewed[reviewed.length - 1] ?? null,
      uciSoFar,
    );
    reviewed.push(reviewedMove);
    prevEvalAfter = evalAfter;
  }

  const s = summary as CachedRow;
  return {
    summary: {
      gameId: s.game_id,
      accuracyWhite: s.accuracy_white ?? 0,
      accuracyBlack: s.accuracy_black ?? 0,
      perfEloWhite: s.perf_elo_white ?? 0,
      perfEloBlack: s.perf_elo_black ?? 0,
      engineMovetimeMs: s.engine_movetime_ms,
      analyzedAt: s.analyzed_at,
      classificationCountsWhite: countsWhite,
      classificationCountsBlack: countsBlack,
    },
    moves: reviewed,
  };
}

function uciToSan(fenBefore: string, uci: string): string {
  if (!uci || uci.length < 4) return "";
  const c = new Chess();
  try {
    c.load(fenBefore);
    const mv = c.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion:
        uci.length > 4 ? (uci.slice(4, 5) as "q" | "r" | "b" | "n") : undefined,
    });
    return mv?.san ?? "";
  } catch {
    return "";
  }
}

function deriveUciFromSan(replay: Chess, san: string): string {
  // chess.js doesn't have a SAN→UCI helper; we replay onto a clone to
  // get the move object back. The replay state is left intact.
  const snapshot = replay.fen();
  const clone = new Chess(snapshot);
  try {
    const mv = clone.move(san);
    if (!mv) return "";
    const promo = mv.promotion ?? "";
    return `${mv.from}${mv.to}${promo}`;
  } catch {
    return "";
  }
}

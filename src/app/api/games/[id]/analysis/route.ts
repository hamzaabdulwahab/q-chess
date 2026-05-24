import { NextRequest, NextResponse } from "next/server";
import { Chess } from "chess.js";
import { getSupabaseServer } from "@/lib/supabase-server";
import {
  blankClassificationCounts,
} from "@/lib/review/classify";
import { commentForMove } from "@/lib/review/coach";
import type {
  Classification,
  Eval,
  ReviewedMove,
  GameAnalysisResponse,
  AnalysisProgress,
} from "@/lib/review/types";

export const runtime = "nodejs";

interface MoveRow {
  move_number: number;
  player: "white" | "black";
  move_notation: string;
  fen_before: string;
  fen_after: string;
  uci: string | null;
}

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const probe = request.nextUrl.searchParams.get("probe") === "true";
  if (probe) {
    // Progress lookup: how many move_analyses rows exist vs total moves.
    const [{ count: total }, { count: analyzed }, { data: summary }] =
      await Promise.all([
        supabase
          .from("moves")
          .select("move_number", { count: "exact", head: true })
          .eq("game_id", gameId),
        supabase
          .from("move_analyses")
          .select("move_number", { count: "exact", head: true })
          .eq("game_id", gameId),
        supabase
          .from("game_analyses")
          .select("game_id")
          .eq("game_id", gameId)
          .maybeSingle(),
      ]);
    const totalPlies = total ?? 0;
    const analyzedPlies = analyzed ?? 0;
    const progress: AnalysisProgress = {
      totalPlies,
      analyzedPlies,
      ready: Boolean(summary) && analyzedPlies >= totalPlies && totalPlies > 0,
    };
    return NextResponse.json(progress);
  }

  // Full payload. Returns { status: "missing" } if there's no cached
  // analysis yet — caller should POST /analyze to kick it off.
  const { data: summary } = await supabase
    .from("game_analyses")
    .select(
      "game_id, accuracy_white, accuracy_black, perf_elo_white, perf_elo_black, engine_movetime_ms, analyzed_at",
    )
    .eq("game_id", gameId)
    .maybeSingle();
  if (!summary) {
    return NextResponse.json({ status: "missing" });
  }

  const [{ data: moveAnalyses }, { data: rawMoves }] = await Promise.all([
    supabase
      .from("move_analyses")
      .select(
        "move_number, eval_cp, eval_mate, best_move_uci, best_move_san, classification, delta_ep, pv_uci",
      )
      .eq("game_id", gameId)
      .order("move_number", { ascending: true }),
    supabase
      .from("moves")
      .select("move_number, player, move_notation, fen_before, fen_after, uci")
      .eq("game_id", gameId)
      .order("move_number", { ascending: true }),
  ]);

  if (!moveAnalyses || !rawMoves) {
    return NextResponse.json({ status: "missing" });
  }

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
    const playedUci = m.uci ?? deriveUci(m.fen_before, m.move_notation);
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
  const response: GameAnalysisResponse = {
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
  return NextResponse.json(response);
}

function deriveUci(fenBefore: string, san: string): string {
  try {
    const c = new Chess(fenBefore);
    const mv = c.move(san);
    if (!mv) return "";
    return `${mv.from}${mv.to}${mv.promotion ?? ""}`;
  } catch {
    return "";
  }
}

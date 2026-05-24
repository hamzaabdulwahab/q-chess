// Chess.com-style move classification & accuracy math.
//
// All evaluations entering this module are in WHITE's POV
// (the engine adapter in `src/lib/stockfish/engine.ts` already
// flips the sign for Black-to-move positions). We translate to the
// *player's* POV before computing the EP drop so the same code works
// for both colours.

import type { Classification, Eval } from "./types";

// ──────────────────────────────────────────────────────────────────
// Expected-Points transform
// ──────────────────────────────────────────────────────────────────

const CP_CLAMP = 1000;

/** EP from White's POV: 1 = winning, 0 = losing, 0.5 = even. */
export const toEp = (e: Eval): number => {
  if (e.mate != null) return e.mate > 0 ? 1 : 0;
  const cp = Math.max(-CP_CLAMP, Math.min(CP_CLAMP, e.cp ?? 0));
  return 1 / (1 + Math.pow(10, -cp / 400));
};

/** EP from the given player's POV (just mirrors for Black). */
export const toEpForPlayer = (e: Eval, player: "white" | "black"): number =>
  player === "white" ? toEp(e) : 1 - toEp(e);

// ──────────────────────────────────────────────────────────────────
// Material delta from raw FENs.
// Returns net change in player's piece value across the move
// (negative = the player gave up material this turn).
// ──────────────────────────────────────────────────────────────────

const PIECE_VALUE: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
};

const sumMaterial = (fen: string, player: "white" | "black"): number => {
  const board = fen.split(/\s+/)[0] ?? "";
  let total = 0;
  for (const ch of board) {
    if (ch === "/" || ch >= "0" && ch <= "9") continue;
    const isWhite = ch === ch.toUpperCase();
    if (player === "white" ? !isWhite : isWhite) continue;
    total += PIECE_VALUE[ch.toLowerCase()] ?? 0;
  }
  return total;
};

export const materialDelta = (
  fenBefore: string,
  fenAfter: string,
  player: "white" | "black",
): number => sumMaterial(fenAfter, player) - sumMaterial(fenBefore, player);

// ──────────────────────────────────────────────────────────────────
// Classification
// ──────────────────────────────────────────────────────────────────

export interface ClassifyInput {
  /** Engine evals in WHITE POV. */
  prevEval: Eval;
  currentEval: Eval;
  bestMoveUci: string;
  playedUci: string;
  player: "white" | "black";
  playerRating?: number;
  fenBefore: string;
  fenAfter: string;
  isBookMove: boolean;
  isOnlyMove: boolean;
  /** Opponent's EP drop on the PRECEDING ply, player-POV. */
  opponentDeltaEpPrev?: number;
}

export interface ClassifyResult {
  cls: Classification;
  /** Player-POV EP drop, clamped to [0, 1]. */
  deltaEp: number;
}

export function classifyMove(i: ClassifyInput): ClassifyResult {
  const epPrev = toEpForPlayer(i.prevEval, i.player);
  const epCurr = toEpForPlayer(i.currentEval, i.player);
  const drop = Math.max(0, Math.min(1, epPrev - epCurr));

  // Base classification by EP drop.
  let cls: Classification;
  if (i.playedUci === i.bestMoveUci || drop === 0) cls = "best";
  else if (drop <= 0.02) cls = "excellent";
  else if (drop <= 0.05) cls = "good";
  else if (drop <= 0.1) cls = "inaccuracy";
  else if (drop <= 0.2) cls = "mistake";
  else cls = "blunder";

  // Book — only overrides "good or better" results so a textbook blunder
  // can't get a free pass.
  if (
    i.isBookMove &&
    (cls === "best" || cls === "excellent" || cls === "good")
  ) {
    cls = "book";
  }

  // Brilliant — sacrifice + stable winning eval.
  if (cls === "best" || cls === "excellent") {
    const mat = materialDelta(i.fenBefore, i.fenAfter, i.player);
    const tolerance = (i.playerRating ?? 1500) < 1500 ? 0.05 : 0.03;
    if (mat <= -3 && epCurr >= epPrev - tolerance && epCurr >= 0.5) {
      cls = "brilliant";
    }
  }

  // Great — only legal move that didn't collapse the position.
  if (cls === "best" && i.isOnlyMove) {
    cls = "great";
  }

  // Miss — opponent just blundered (their EP dropped > 0.20 from our
  // POV, so our EP went up by > 0.20), and we failed to capitalise.
  if (
    (cls === "inaccuracy" || cls === "mistake" || cls === "blunder") &&
    (i.opponentDeltaEpPrev ?? 0) > 0.2
  ) {
    cls = "miss";
  }

  return { cls, deltaEp: drop };
}

// ──────────────────────────────────────────────────────────────────
// Game-level accuracy & performance rating
// ──────────────────────────────────────────────────────────────────

/**
 * Chess.com canonical accuracy formula. `avgDeltaEp` is the mean
 * EP drop across one player's moves in [0,1] units. The constants
 * are chess.com's published coefficients; the `avg * 100` rescales
 * to their published percentage-point domain.
 */
export const accuracyFromAvgDeltaEp = (avg: number): number => {
  const raw = 103.1668 * Math.exp(-0.04354 * avg * 100) - 3.1669;
  return Math.max(0, Math.min(100, raw));
};

/** Rough linear projection of an accuracy % into an Elo-shaped number. */
export const perfEloFromAccuracy = (acc: number): number =>
  Math.max(400, Math.min(2800, Math.round(400 + acc * 22)));

export const blankClassificationCounts = (): Record<Classification, number> => ({
  brilliant: 0,
  great: 0,
  best: 0,
  excellent: 0,
  good: 0,
  book: 0,
  inaccuracy: 0,
  mistake: 0,
  blunder: 0,
  miss: 0,
});

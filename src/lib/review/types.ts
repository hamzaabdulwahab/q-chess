// Public type vocabulary for the post-game Game Review feature.

export type Classification =
  | "brilliant"
  | "great"
  | "best"
  | "excellent"
  | "good"
  | "book"
  | "inaccuracy"
  | "mistake"
  | "blunder"
  | "miss";

export interface Eval {
  /** Centipawns from WHITE's POV. Null when the line is forced mate. */
  cp: number | null;
  /** Moves-to-mate from WHITE's POV. Null when the line has no forced mate. */
  mate: number | null;
}

export interface ReviewedMove {
  /** 1-indexed ply (matches public.moves.move_number). */
  ply: number;
  fenBefore: string;
  fenAfter: string;
  san: string;
  /** UCI long-algebraic, e.g. "e2e4". Empty string when source data is missing. */
  uci: string;
  player: "white" | "black";
  evalBefore: Eval;
  evalAfter: Eval;
  /** Engine's chosen move at fenBefore. */
  bestMoveUci: string;
  bestMoveSan: string;
  classification: Classification;
  /** EP drop from the player's POV. Range [0, 1]. */
  deltaEp: number;
  /** Short, deterministic coach commentary. */
  coachComment: string;
  /** Highlight squares for the played move (drives ChessBoard slide-in). */
  highlight?: { from: string; to: string };
}

export interface GameAnalysisSummary {
  gameId: number;
  accuracyWhite: number; // 0..100
  accuracyBlack: number;
  perfEloWhite: number;
  perfEloBlack: number;
  engineMovetimeMs: number;
  analyzedAt: string; // ISO
  classificationCountsWhite: Record<Classification, number>;
  classificationCountsBlack: Record<Classification, number>;
}

export interface GameAnalysisResponse {
  summary: GameAnalysisSummary;
  moves: ReviewedMove[];
}

export interface AnalysisProgress {
  totalPlies: number;
  analyzedPlies: number;
  ready: boolean;
}

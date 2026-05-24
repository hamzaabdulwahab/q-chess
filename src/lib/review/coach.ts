// Deterministic coach copy for each move classification.
// No LLM call; templates only. Short, scannable, references the
// played move and the engine's best alternative.

import type { ReviewedMove } from "./types";
import { matchOpening } from "./openings";

const pawnsFromDeltaCp = (deltaCp: number): string => {
  const pawns = Math.abs(deltaCp) / 100;
  if (pawns < 1) return `${(deltaCp / 100).toFixed(1)}`;
  return `${pawns.toFixed(1)}`;
};

const evalAfterPawns = (m: ReviewedMove): string => {
  const after = m.evalAfter.cp;
  if (after == null) return m.evalAfter.mate != null ? `M${m.evalAfter.mate}` : "0.0";
  const signed = (after / 100).toFixed(1);
  return after > 0 ? `+${signed}` : signed;
};

export function commentForMove(
  m: ReviewedMove,
  prev: ReviewedMove | null,
  gameUciPrefix: string[],
): string {
  const best = m.bestMoveSan;

  switch (m.classification) {
    case "best":
      return `Best move. The engine agrees — ${m.san} keeps the evaluation at ${evalAfterPawns(m)}.`;

    case "excellent":
      return `Excellent. ${m.san} is among the engine's top choices; only a hair behind ${best}.`;

    case "good":
      return `Good move. The position holds, though ${best} was slightly sharper.`;

    case "book": {
      const op = matchOpening(gameUciPrefix);
      if (op) return `Theory. Standard move in the ${op.eco} ${op.name}.`;
      return `Theory. Known opening move.`;
    }

    case "inaccuracy":
      return `Inaccuracy. ${best} would have kept more pressure; ${m.san} concedes ${pawnsFromDeltaCp((m.evalBefore.cp ?? 0) - (m.evalAfter.cp ?? 0))} pawns of evaluation.`;

    case "mistake":
      return `Mistake. ${m.san} drops the evaluation noticeably — ${best} was the right path.`;

    case "blunder": {
      const drop =
        (m.evalBefore.cp ?? 0) - (m.evalAfter.cp ?? 0);
      return `Blunder. This loses ${pawnsFromDeltaCp(drop)} pawns of evaluation. ${best} held the position.`;
    }

    case "brilliant":
      return `Brilliant! A bold sacrifice — the engine confirms the position still favors you despite the material deficit.`;

    case "great":
      return `Great move. ${m.san} was the only continuation that didn't drop into a worse position.`;

    case "miss": {
      if (prev) {
        return `Missed chance. ${prev.bestMoveSan} would have punished your opponent's previous move; ${m.san} lets the advantage slip.`;
      }
      return `Missed chance. The engine had a much stronger continuation here.`;
    }
  }
}

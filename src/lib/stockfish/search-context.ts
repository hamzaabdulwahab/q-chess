import type { Chess } from "chess.js";

export interface StockfishSearchContext {
  legalMoveCount: number;
  pieceCount: number;
  fullMoveNumber: number;
}

export function getStockfishSearchContext(
  chess: Chess,
): StockfishSearchContext {
  const pieceCount = chess
    .board()
    .flat()
    .filter(Boolean).length;
  const fullMoveNumber = Number(chess.fen().split(" ")[5]) || 1;

  return {
    legalMoveCount: chess.moves().length,
    pieceCount,
    fullMoveNumber,
  };
}

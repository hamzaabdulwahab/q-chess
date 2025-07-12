export interface ChessPosition {
  rank: number;
  file: number;
}

export interface ChessMove {
  from: ChessPosition;
  to: ChessPosition;
  piece: string;
  captured?: string;
  promotion?: string;
}

export interface GameStatus {
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  isInCheck: boolean;
  turn: "white" | "black";
}

export interface MoveResult {
  success: boolean;
  san?: string;
  capturedPiece?: string;
  fen?: string;
  error?: string;
}

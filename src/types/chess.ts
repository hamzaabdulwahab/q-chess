export interface Game {
  id: number;
  fen: string;
  pgn?: string | null;
  status:
    | "active"
    | "checkmate"
    | "stalemate"
    | "draw"
    | "resigned"
    | "timeout";
  currentPlayer: "white" | "black";
  winner?: "white" | "black" | "draw" | null;
  userId?: string | null;
  whiteUserId?: string | null;
  blackUserId?: string | null;
  timeControlInitialMs?: number | null;
  incrementMs?: number;
  whiteTimeLeftMs?: number | null;
  blackTimeLeftMs?: number | null;
  lastMoveAt?: Date | null;
  startedAt?: Date | null;
  endedAt?: Date | null;
  resultReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
  moveCount: number;
}

export interface Move {
  id: number;
  gameId: number;
  moveNumber: number;
  player: "white" | "black";
  moveNotation: string;
  fenBefore: string;
  fenAfter: string;
  pgn?: string | null;
  capturedPiece?: string | null;
  isCheck: number;
  isCheckmate: number;
  isCastling: number;
  isEnPassant: number;
  isPromotion: number;
  createdAt: Date;
}
export interface GameStats {
  totalGames: number;
  activeGames: number;
  completedGames: number;
  lastUpdated: Date;
}

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

export interface GameWithMoves extends Game {
  moves: Move[];
  totalMoves: number;
}

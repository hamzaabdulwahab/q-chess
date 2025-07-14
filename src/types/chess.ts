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

export interface Game {
  id: number;
  status: string;
  winner?: "white" | "black" | "draw";
  created_at: string;
  updated_at: string;
  fen: string;
  pgn: string;
}

export interface Move {
  id: number;
  game_id: number;
  move_number: number;
  player: "white" | "black";
  san: string;
  fen_before: string;
  fen_after: string;
  pgn: string;
  created_at: string;
}

export interface GameWithMoves extends Game {
  moves: Move[];
  totalMoves: number;
}

import { Chess } from "chess.js";

export class ChessClient {
  private chess: Chess;

  constructor(fen?: string) {
    this.chess = new Chess(fen);
  }

  // Get possible moves for a square
  getPossibleMoves(square: string): string[] {
    try {
      const moves = this.chess.moves({
        square: square as any,
        verbose: true,
      });
      return moves.map((move: any) => move.to);
    } catch (error) {
      console.error("Error getting possible moves:", error);
      return [];
    }
  }

  // Get all legal moves with detailed information
  getAllMovesDetailed(): any[] {
    try {
      return this.chess.moves({ verbose: true });
    } catch (error) {
      console.error("Error getting detailed moves:", error);
      return [];
    }
  }

  // Check if a move is legal
  isMoveLegal(from: string, to: string, promotion?: string): boolean {
    try {
      // Create a copy of the game to test the move
      const testChess = new Chess(this.chess.fen());
      const move = testChess.move({
        from,
        to,
        promotion: promotion as any,
      });
      return move !== null;
    } catch (error) {
      return false;
    }
  }

  // Get move details (including special move flags)
  getMoveDetails(from: string, to: string, promotion?: string): any {
    try {
      const moves = this.chess.moves({ verbose: true });
      return moves.find(
        (move: any) =>
          move.from === from &&
          move.to === to &&
          (!promotion || move.promotion === promotion)
      );
    } catch (error) {
      return null;
    }
  }

  // Get all legal moves
  getAllMoves(): string[] {
    return this.chess.moves();
  }

  // Make a move (client-side only, no database)
  makeMove(
    from: string,
    to: string,
    promotion?: string
  ): {
    success: boolean;
    san?: string;
    capturedPiece?: string;
    fen?: string;
    error?: string;
  } {
    try {
      const move = this.chess.move({
        from,
        to,
        promotion: promotion as any,
      });

      if (!move) {
        return { success: false, error: "Invalid move" };
      }

      return {
        success: true,
        san: move.san,
        capturedPiece: move.captured,
        fen: this.chess.fen(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Invalid move",
      };
    }
  }

  // Check if position is in check
  isInCheck(): boolean {
    return this.chess.inCheck();
  }

  // Get current turn
  getCurrentTurn(): "white" | "black" {
    return this.chess.turn() === "w" ? "white" : "black";
  }

  // Get FEN string
  getFen(): string {
    return this.chess.fen();
  }

  // Get PGN string
  getPgn(): string {
    return this.chess.pgn();
  }

  // Check if game is over
  isGameOver(): boolean {
    return this.chess.isGameOver();
  }

  // Get game status
  getGameStatus(): {
    isCheckmate: boolean;
    isStalemate: boolean;
    isDraw: boolean;
    isInCheck: boolean;
    turn: "white" | "black";
  } {
    return {
      isCheckmate: this.chess.isCheckmate(),
      isStalemate: this.chess.isStalemate(),
      isDraw: this.chess.isDraw(),
      isInCheck: this.chess.inCheck(),
      turn: this.chess.turn() === "w" ? "white" : "black",
    };
  }

  // Load a position from FEN
  loadFen(fen: string): boolean {
    try {
      this.chess.load(fen);
      return true;
    } catch {
      return false;
    }
  }

  // Get move history
  getHistory(): string[] {
    return this.chess.history();
  }

  // Get captured pieces
  getCapturedPieces(): { white: string[]; black: string[] } {
    const history = this.chess.history({ verbose: true });
    const captured = { white: [] as string[], black: [] as string[] };

    for (const move of history) {
      if (move.captured) {
        if (move.color === "w") {
          captured.white.push(move.captured);
        } else {
          captured.black.push(move.captured);
        }
      }
    }

    return captured;
  }

  // Undo last move
  undo(): boolean {
    const move = this.chess.undo();
    return move !== null;
  }

  // Get piece at square
  getPiece(square: string): string | null {
    const piece = this.chess.get(square as any);
    if (!piece) return null;
    return piece.color + piece.type.toUpperCase();
  }
}

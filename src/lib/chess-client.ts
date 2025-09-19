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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        square: square as any,
        verbose: true,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return moves.map((move: any) => move.to);
    } catch {
      console.error("Error getting possible moves");
      return [];
    }
  }

  // Get all legal moves with detailed information
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getAllMovesDetailed(): any[] {
    try {
      return this.chess.moves({ verbose: true });
    } catch {
      console.error("Error getting detailed moves");
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        promotion: promotion as any,
      });
      return move !== null;
    } catch {
      return false;
    }
  }

  // Get move details (including special move flags)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getMoveDetails(from: string, to: string, promotion?: string): any {
    try {
      const moves = this.chess.moves({ verbose: true });
      return moves.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (move: any) =>
          move.from === from &&
          move.to === to &&
          (!promotion || move.promotion === promotion)
      );
    } catch {
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const piece = this.chess.get(square as any);
    if (!piece) return null;
    return piece.color + piece.type.toUpperCase();
  }

  // Get squares of pieces giving check
  getCheckingPieces(): string[] {
    if (!this.chess.inCheck()) return [];
    
    // Get the current position and create a temporary chess instance
    const currentFen = this.chess.fen();
    const currentTurn = this.chess.turn();
    const kingSquare = this.findKingSquare(currentTurn);
    
    if (!kingSquare) return [];
    
    console.log(`Debugging check detection: King at ${kingSquare}, turn: ${currentTurn}`);
    
    const checkingPieces: string[] = [];
    
    // Try a different approach: create a position without the king and see which pieces can move to the king's square
    const board = this.chess.board();
    
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file];
        if (piece && piece.color !== currentTurn) {
          const fromSquare = String.fromCharCode(97 + file) + (8 - rank);
          
          // Create a test position where we try to move this piece to the king's square
          try {
            const testChess = new Chess(currentFen);
            
            // Try to make the move to see if it's a legal attack
            const testMove = testChess.move({
              from: fromSquare,
              to: kingSquare,
            });
            
            if (testMove) {
              console.log(`Piece at ${fromSquare} (${piece.color}${piece.type}) can capture king at ${kingSquare}`);
              checkingPieces.push(fromSquare);
            }
          } catch {
            // This move is not legal, continue
          }
          
          // Alternative approach: check if this piece type can theoretically attack the king's square
          if (this.canPieceTypeAttackSquare(piece, fromSquare, kingSquare)) {
            if (!checkingPieces.includes(fromSquare)) {
              console.log(`Piece type check: ${piece.color}${piece.type} at ${fromSquare} can attack ${kingSquare}`);
              checkingPieces.push(fromSquare);
            }
          }
        }
      }
    }
    
    console.log('Final checking pieces found:', checkingPieces);
    return checkingPieces;
  }

  // Check if a piece type can attack a square based on chess rules
  private canPieceTypeAttackSquare(piece: { type: string; color: string }, fromSquare: string, toSquare: string): boolean {
    const fromFile = fromSquare.charCodeAt(0) - 97; // a=0, b=1, etc.
    const fromRank = parseInt(fromSquare[1]) - 1; // 1=0, 2=1, etc.
    const toFile = toSquare.charCodeAt(0) - 97;
    const toRank = parseInt(toSquare[1]) - 1;
    
    const fileDiff = Math.abs(toFile - fromFile);
    const rankDiff = Math.abs(toRank - fromRank);
    
    switch (piece.type.toLowerCase()) {
      case 'p': // Pawn
        const direction = piece.color === 'w' ? 1 : -1;
        return (toRank - fromRank === direction) && (fileDiff === 1);
      
      case 'r': // Rook
        return (fileDiff === 0 || rankDiff === 0) && this.isPathClear(fromSquare, toSquare);
      
      case 'n': // Knight
        return (fileDiff === 2 && rankDiff === 1) || (fileDiff === 1 && rankDiff === 2);
      
      case 'b': // Bishop
        return (fileDiff === rankDiff) && this.isPathClear(fromSquare, toSquare);
      
      case 'q': // Queen
        return ((fileDiff === 0 || rankDiff === 0) || (fileDiff === rankDiff)) && this.isPathClear(fromSquare, toSquare);
      
      case 'k': // King
        return fileDiff <= 1 && rankDiff <= 1;
      
      default:
        return false;
    }
  }

  // Check if the path between two squares is clear
  private isPathClear(fromSquare: string, toSquare: string): boolean {
    const fromFile = fromSquare.charCodeAt(0) - 97;
    const fromRank = parseInt(fromSquare[1]) - 1;
    const toFile = toSquare.charCodeAt(0) - 97;
    const toRank = parseInt(toSquare[1]) - 1;
    
    const fileDiff = toFile - fromFile;
    const rankDiff = toRank - fromRank;
    
    const steps = Math.max(Math.abs(fileDiff), Math.abs(rankDiff));
    if (steps <= 1) return true; // Adjacent squares
    
    const fileStep = fileDiff === 0 ? 0 : fileDiff / Math.abs(fileDiff);
    const rankStep = rankDiff === 0 ? 0 : rankDiff / Math.abs(rankDiff);
    
    // Check each square in the path
    for (let i = 1; i < steps; i++) {
      const checkFile = fromFile + (fileStep * i);
      const checkRank = fromRank + (rankStep * i);
      const checkSquare = String.fromCharCode(97 + checkFile) + (checkRank + 1);
      
      if (this.getPiece(checkSquare)) {
        return false; // Path is blocked
      }
    }
    
    return true;
  }

  // Find the king square for the given color
  private findKingSquare(color: 'w' | 'b'): string | null {
    const board = this.chess.board();
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file];
        if (piece && piece.type === 'k' && piece.color === color) {
          return String.fromCharCode(97 + file) + (8 - rank);
        }
      }
    }
    return null;
  }
}

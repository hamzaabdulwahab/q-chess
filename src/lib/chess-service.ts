import { Chess } from "chess.js";
import { pool } from "@/lib/database";
import { Game, Move, GameWithMoves } from "@/types/chess";
import { RowDataPacket, ResultSetHeader } from "mysql2";

export class ChessService {
  public chess: Chess;

  constructor(fen?: string) {
    this.chess = new Chess(fen);
  }

  // Create a new game
  static async createNewGame(): Promise<number> {
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.execute<RowDataPacket[]>(
        "CALL CreateNewGame()"
      );
      // The stored procedure returns nested array structure: [[ { game_id: number } ], ResultSetHeader]
      // So we need result[0][0].game_id
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (result[0] as any)[0].game_id;
    } finally {
      connection.release();
    }
  }

  // Get game by ID
  static async getGame(gameId: number): Promise<GameWithMoves | null> {
    const connection = await pool.getConnection();
    try {
      const [gameRows] = await connection.execute<RowDataPacket[]>(
        "SELECT * FROM games WHERE id = ?",
        [gameId]
      );

      if (gameRows.length === 0) {
        return null;
      }

      const game = gameRows[0] as Game;

      const [moveRows] = await connection.execute<RowDataPacket[]>(
        "SELECT * FROM moves WHERE game_id = ? ORDER BY move_number ASC",
        [gameId]
      );

      const moves = moveRows as Move[];

      return {
        ...game,
        moves,
        totalMoves: moves.length,
      };
    } finally {
      connection.release();
    }
  }

  // Get all games
  static async getAllGames(): Promise<GameWithMoves[]> {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute<RowDataPacket[]>(
        "SELECT * FROM recent_games ORDER BY updated_at DESC"
      );

      const games = rows as (Game & { total_moves: number })[];

      // Get moves for each game
      const gamesWithMoves = await Promise.all(
        games.map(async (game) => {
          const [moveRows] = await connection.execute<RowDataPacket[]>(
            "SELECT * FROM moves WHERE game_id = ? ORDER BY move_number ASC",
            [game.id]
          );

          return {
            ...game,
            moves: moveRows as Move[],
            totalMoves: game.total_moves || moveRows.length,
          };
        })
      );

      return gamesWithMoves;
    } finally {
      connection.release();
    }
  }

  // Delete a game
  static async deleteGame(gameId: number): Promise<boolean> {
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.execute<ResultSetHeader>(
        "DELETE FROM games WHERE id = ?",
        [gameId]
      );
      return result.affectedRows > 0;
    } finally {
      connection.release();
    }
  }

  // Delete all games
  static async deleteAllGames(): Promise<number> {
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.execute<ResultSetHeader>(
        "DELETE FROM games"
      );
      return result.affectedRows || 0;
    } finally {
      connection.release();
    }
  }

  // Make a move
  async makeMove(
    gameId: number,
    from: string,
    to: string,
    promotion?: string
  ): Promise<{
    success: boolean;
    fen?: string;
    pgn?: string;
    san?: string;
    capturedPiece?: string;
    gameStatus?: string;
    winner?: "white" | "black" | "draw";
    error?: string;
  }> {
    try {
      const fenBefore = this.chess.fen();
      const historyLength = this.chess.history().length;
      // Chess move numbering: Move 1 = white's 1st move, Move 1 = black's 1st move, Move 2 = white's 2nd move, etc.
      const moveNumber = Math.floor(historyLength / 2) + 1;
      const player = this.chess.turn() === "w" ? "white" : "black";

      // Attempt to make the move
      const move = this.chess.move({
        from,
        to,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        promotion: promotion as any,
      });

      if (!move) {
        return { success: false, error: "Invalid move" };
      }

      const fenAfter = this.chess.fen();
      const pgn = this.chess.pgn();

      // Check game status
      let gameStatus = "active";
      let winner: "white" | "black" | "draw" | undefined;

      if (this.chess.isCheckmate()) {
        gameStatus = "checkmate";
        // The player who just moved wins (they checkmated their opponent)
        winner = player;
      } else if (this.chess.isStalemate()) {
        gameStatus = "stalemate";
        winner = "draw";
      } else if (this.chess.isDraw()) {
        gameStatus = "draw";
        winner = "draw";
      }

      // Record the move in database
      const connection = await pool.getConnection();
      try {
        await connection.execute("CALL RecordMove(?, ?, ?, ?, ?, ?, ?)", [
          gameId,
          moveNumber,
          player,
          move.san,
          fenBefore,
          fenAfter,
          pgn,
        ]);

        // If game is complete, update game status
        if (gameStatus !== "active") {
          await connection.execute("CALL CompleteGame(?, ?, ?)", [
            gameId,
            gameStatus,
            winner,
          ]);
        }
      } finally {
        connection.release();
      }

      return {
        success: true,
        fen: fenAfter,
        pgn,
        san: move.san,
        capturedPiece: move.captured,
        gameStatus,
        winner,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
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

  // Get all legal moves
  getAllMoves(): string[] {
    try {
      return this.chess.moves();
    } catch {
      console.error("Error getting moves");
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

  // Check if a move involves castling
  isCastlingMove(from: string, to: string): boolean {
    try {
      const moves = this.chess.moves({ verbose: true });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const move = moves.find((m: any) => m.from === from && m.to === to);
      return Boolean(
        move && (move.flags.includes("k") || move.flags.includes("q"))
      );
    } catch {
      return false;
    }
  }

  // Check if a move involves en passant
  isEnPassantMove(from: string, to: string): boolean {
    try {
      const moves = this.chess.moves({ verbose: true });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const move = moves.find((m: any) => m.from === from && m.to === to);
      return Boolean(move && move.flags.includes("e"));
    } catch {
      return false;
    }
  }

  // Check if a move is a pawn promotion
  isPromotionMove(from: string, to: string): boolean {
    try {
      const moves = this.chess.moves({ verbose: true });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const move = moves.find((m: any) => m.from === from && m.to === to);
      return Boolean(move && move.flags.includes("p"));
    } catch {
      return false;
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

  // Get move history
  getHistory(): string[] {
    return this.chess.history();
  }

  // Load FEN position
  loadFen(fen: string): boolean {
    try {
      this.chess.load(fen);
      return true;
    } catch {
      return false;
    }
  }

  // Reset game
  reset(): void {
    this.chess.reset();
  }

  // Get piece at square
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getPiece(square: string): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.chess.get(square as any);
  }

  // Get ASCII representation (for debugging)
  ascii(): string {
    return this.chess.ascii();
  }
}

// Utility functions
export function squareToCoords(square: string): { file: number; rank: number } {
  const file = square.charCodeAt(0) - 97; // 'a' = 0, 'b' = 1, etc.
  const rank = parseInt(square[1]) - 1; // '1' = 0, '2' = 1, etc.
  return { file, rank };
}

export function coordsToSquare(file: number, rank: number): string {
  const fileChar = String.fromCharCode(97 + file); // 0 = 'a', 1 = 'b', etc.
  const rankChar = (rank + 1).toString(); // 0 = '1', 1 = '2', etc.
  return fileChar + rankChar;
}

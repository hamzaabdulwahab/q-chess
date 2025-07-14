import { Chess } from "chess.js";
import { supabase } from "./supabase";

export class ChessService {
  public chess: Chess;
  private gameId?: string;

  constructor(fen?: string, gameId?: string) {
    this.chess = new Chess(fen);
    this.gameId = gameId;
  }

  // Make a move
  async makeMove(
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
        winner = this.chess.turn() === "w" ? "black" : "white";
      } else if (this.chess.isStalemate()) {
        gameStatus = "stalemate";
        winner = "draw";
      } else if (this.chess.isDraw()) {
        gameStatus = "draw";
        winner = "draw";
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

  // Database methods for Supabase integration

  // Create a new game in the database
  async createGame(whitePlayerId?: string, blackPlayerId?: string): Promise<{
    success: boolean;
    gameId?: string;
    error?: string;
  }> {
    try {
      const { data, error } = await supabase
        .from("games")
        .insert([
          {
            white_player_id: whitePlayerId,
            black_player_id: blackPlayerId,
            fen: this.chess.fen(),
            pgn: this.chess.pgn(),
            status: "active",
          },
        ])
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      this.gameId = data.id;
      return { success: true, gameId: data.id };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Save current game state to database
  async saveGame(): Promise<{ success: boolean; error?: string }> {
    if (!this.gameId) {
      return { success: false, error: "No game ID available" };
    }

    try {
      let gameStatus = "active";
      let winner: string | null = null;

      if (this.chess.isCheckmate()) {
        gameStatus = "checkmate";
        winner = this.chess.turn() === "w" ? "black" : "white";
      } else if (this.chess.isStalemate()) {
        gameStatus = "stalemate";
        winner = "draw";
      } else if (this.chess.isDraw()) {
        gameStatus = "draw";
        winner = "draw";
      }

      const { error } = await supabase
        .from("games")
        .update({
          fen: this.chess.fen(),
          pgn: this.chess.pgn(),
          status: gameStatus,
          winner,
          updated_at: new Date().toISOString(),
        })
        .eq("id", this.gameId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Save a move to the database
  async saveMove(san: string, moveNumber: number): Promise<{
    success: boolean;
    error?: string;
  }> {
    if (!this.gameId) {
      return { success: false, error: "No game ID available" };
    }

    try {
      const { error } = await supabase
        .from("moves")
        .insert([
          {
            game_id: this.gameId,
            move_number: moveNumber,
            san,
            fen_after: this.chess.fen(),
          },
        ]);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Load game from database
  async loadGame(gameId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const { data, error } = await supabase
        .from("games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data) {
        return { success: false, error: "Game not found" };
      }

      this.gameId = gameId;
      if (data.fen) {
        this.chess.load(data.fen);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Get game data from database
  async getGameData(gameId: string): Promise<{
    success: boolean;
    game?: {
      id: string;
      white_player_id: string | null;
      black_player_id: string | null;
      fen: string;
      pgn: string | null;
      status: string;
      winner: string | null;
      created_at: string;
      updated_at: string;
    };
    error?: string;
  }> {
    try {
      const { data, error } = await supabase
        .from("games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, game: data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Get all games for a player
  async getPlayerGames(playerId: string): Promise<{
    success: boolean;
    games?: Array<{
      id: string;
      white_player_id: string | null;
      black_player_id: string | null;
      fen: string;
      pgn: string | null;
      status: string;
      winner: string | null;
      created_at: string;
      updated_at: string;
    }>;
    error?: string;
  }> {
    try {
      const { data, error } = await supabase
        .from("games")
        .select("*")
        .or(`white_player_id.eq.${playerId},black_player_id.eq.${playerId}`)
        .order("created_at", { ascending: false });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, games: data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Get moves for a game
  async getGameMoves(gameId: string): Promise<{
    success: boolean;
    moves?: Array<{
      id: string;
      game_id: string;
      move_number: number;
      san: string;
      fen_after: string;
      created_at: string;
    }>;
    error?: string;
  }> {
    try {
      const { data, error } = await supabase
        .from("moves")
        .select("*")
        .eq("game_id", gameId)
        .order("move_number", { ascending: true });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, moves: data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Subscribe to game updates (real-time)
  subscribeToGame(gameId: string, callback: (payload: { 
    eventType: string; 
    new: Record<string, unknown>; 
    old: Record<string, unknown> 
  }) => void): () => void {
    const subscription = supabase
      .channel(`game-${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `id=eq.${gameId}`,
        },
        callback
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }

  // Subscribe to move updates (real-time)
  subscribeToMoves(gameId: string, callback: (payload: { 
    eventType: string; 
    new: Record<string, unknown>; 
    old: Record<string, unknown> 
  }) => void): () => void {
    const subscription = supabase
      .channel(`moves-${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "moves",
          filter: `game_id=eq.${gameId}`,
        },
        callback
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }

  // Set game ID
  setGameId(gameId: string): void {
    this.gameId = gameId;
  }

  // Get current game ID
  getGameId(): string | undefined {
    return this.gameId;
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

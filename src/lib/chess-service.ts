/* eslint-disable @typescript-eslint/no-explicit-any */

import { Chess } from "chess.js";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabasePooledClient } from "@/lib/supabase-pooled";

export class ChessService {
  public chess: Chess;

  constructor(fen?: string) {
    this.chess = new Chess(fen);
  }

  // Get the appropriate Supabase client based on operation type
  private static getClient() {
    // Use service role key if available for better performance
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return getSupabasePooledClient();
    }
    // Fallback to regular server client
    return getSupabaseServer();
  }

  // Create a new game
  static async createNewGame(userId?: string): Promise<number> {
    const supabase = ChessService.getClient();
    const chess = new Chess();
    const initialFen = chess.fen();

    // If no userId provided, get current user
    let gameUserId = userId;
    if (!gameUserId) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("User must be authenticated to create a game");
      }
      gameUserId = user.id;
    }

    const { data, error } = await supabase
      .from("games")
      .insert({
        fen: initialFen,
        pgn: null,
        status: "active",
        current_player: "white",
        winner: null,
        move_count: 0,
        user_id: gameUserId,
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Failed to create game");
    }
    return data.id as number;
  }

  // Get game by ID with user authentication (enforces RLS)
  static async getGameForUser(
    gameId: number,
    userId: string
  ): Promise<
    | (Record<string, unknown> & {
        moves: Record<string, unknown>[];
        totalMoves: number;
      })
    | null
  > {
    // SECURITY: Use server client with user auth context to enforce RLS
    const supabase = getSupabaseServer();
    
    // Single query to get game with moves using JOIN
    // RLS policies will ensure the user can only access their own games
    const { data: gameData, error: gameError } = await supabase
      .from("games")
      .select(`
        *,
        moves (
          id,
          move_number,
          player,
          move_notation,
          fen_before,
          fen_after,
          pgn,
          captured_piece,
          is_check,
          is_checkmate,
          is_castling,
          is_en_passant,
          is_promotion,
          created_at,
          updated_at
        )
      `)
      .eq("id", gameId)
      .eq("user_id", userId) // Explicit user check for extra security
      .single();

    if (gameError || !gameData) {
      return null;
    }

    // Sort moves by move_number to ensure correct order
    const moves = (gameData.moves as any[]) || [];
    moves.sort((a: any, b: any) => a.move_number - b.move_number);

    return {
      ...gameData,
      moves: moves as Record<string, unknown>[],
      totalMoves: moves.length,
    };
  }

  // Get game by ID (DEPRECATED - use getGameForUser instead for security)
  static async getGame(
    gameId: number
  ): Promise<
    | (Record<string, unknown> & {
        moves: Record<string, unknown>[];
        totalMoves: number;
      })
    | null
  > {
    const supabase = ChessService.getClient();
    
    // Single query to get game with moves using JOIN
    const { data: gameData, error: gameError } = await supabase
      .from("games")
      .select(`
        *,
        moves (
          id,
          move_number,
          player,
          move_notation,
          fen_before,
          fen_after,
          pgn,
          captured_piece,
          is_check,
          is_checkmate,
          is_castling,
          is_en_passant,
          is_promotion,
          created_at,
          updated_at
        )
      `)
      .eq("id", gameId)
      .single();

    if (gameError || !gameData) {
      return null;
    }

    // Sort moves by move_number to ensure correct order
    const moves = (gameData.moves as any[]) || [];
    moves.sort((a: any, b: any) => a.move_number - b.move_number);

    return {
      ...gameData,
      moves: moves as Record<string, unknown>[],
      totalMoves: moves.length,
    };
  }

  // Get all games
  static async getAllGames(): Promise<
    (Record<string, unknown> & {
      moves: Record<string, unknown>[];
      totalMoves: number;
    })[]
  > {
    const supabase = ChessService.getClient();
    
    // Single query to get games with moves using JOIN
    const { data: gamesData, error } = await supabase
      .from("games")
      .select(`
        *,
        moves (
          id,
          move_number,
          player,
          move_notation,
          fen_before,
          fen_after,
          pgn,
          captured_piece,
          is_check,
          is_checkmate,
          is_castling,
          is_en_passant,
          is_promotion,
          created_at,
          updated_at
        )
      `)
      .order("updated_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    // Transform the data to match the expected structure
    const gamesWithMoves = (gamesData || []).map((game: any) => {
      const moves = game.moves || [];
      // Sort moves by move_number to ensure correct order
      moves.sort((a: any, b: any) => a.move_number - b.move_number);
      
      return {
        ...game,
        moves: moves as Record<string, unknown>[],
        totalMoves: moves.length,
      };
    });

    return gamesWithMoves;
  }

  // Get games for a specific user (lightweight version for lists)
  static async getUserGamesLight(
    userId: string, 
    page: number = 1, 
    limit: number = 20
  ): Promise<{
    games: (Record<string, unknown> & { totalMoves: number })[];
    total: number;
  }> {
    const supabase = ChessService.getClient();
    
    // Calculate offset for pagination
    const offset = (page - 1) * limit;
    
    // Get total count first
    const { count } = await supabase
      .from("games")
      .select("*", { count: 'exact', head: true })
      .eq("user_id", userId);

    // Lightweight query without moves data, just count
    const { data: gamesData, error: gamesError } = await supabase
      .from("games")
      .select(`
        id,
        status,
        current_player,
        winner,
        move_count,
        created_at,
        updated_at
      `)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (gamesError) {
      throw new Error(gamesError.message);
    }

    // Get move counts for these games in a single query
    const gameIds = (gamesData || []).map((game: any) => game.id);
    let moveCounts: Record<number, number> = {};
    
    if (gameIds.length > 0) {
      const { data: moveCountsData, error: moveCountsError } = await supabase
        .from("moves")
        .select("game_id")
        .in("game_id", gameIds);

      if (!moveCountsError && moveCountsData) {
        // Count moves per game
        moveCounts = moveCountsData.reduce((acc: Record<number, number>, move: any) => {
          acc[move.game_id] = (acc[move.game_id] || 0) + 1;
          return acc;
        }, {});
      }
    }

    // Transform the data to include move count
    const gamesLight = (gamesData || []).map((game: any) => ({
      ...game,
      totalMoves: moveCounts[game.id] || 0,
    }));

    return {
      games: gamesLight,
      total: count || 0
    };
  }

  // Get games for a specific user (full version with moves)
  static async getUserGames(userId: string): Promise<
    (Record<string, unknown> & {
      moves: Record<string, unknown>[];
      totalMoves: number;
    })[]
  > {
    const supabase = ChessService.getClient();
    
    // Single query to get games with move counts using JOIN
    const { data: gamesData, error: gamesError } = await supabase
      .from("games")
      .select(`
        *,
        moves (
          id,
          move_number,
          player,
          move_notation,
          fen_before,
          fen_after,
          pgn,
          captured_piece,
          is_check,
          is_checkmate,
          is_castling,
          is_en_passant,
          is_promotion,
          created_at,
          updated_at
        )
      `)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (gamesError) {
      throw new Error(gamesError.message);
    }

    // Transform the data to match the expected structure
    const gamesWithMoves = (gamesData || []).map((game: any) => {
      const moves = game.moves || [];
      // Sort moves by move_number to ensure correct order
      moves.sort((a: any, b: any) => a.move_number - b.move_number);
      
      return {
        ...game,
        moves: moves as Record<string, unknown>[],
        totalMoves: moves.length,
      };
    });

    return gamesWithMoves;
  }

  // Delete a game
  static async deleteGame(gameId: number): Promise<boolean> {
    const supabase = ChessService.getClient();
    // Delete moves first (in case no FK cascade)
    await supabase.from("moves").delete().eq("game_id", gameId);
    const { error } = await supabase.from("games").delete().eq("id", gameId);
    return !error;
  }

  // Delete all games
  static async deleteAllGames(): Promise<number> {
    const supabase = ChessService.getClient();
    await supabase.from("moves").delete().neq("id", 0);
    const { error } = await supabase.from("games").delete().neq("id", 0);
    if (error) throw new Error(error.message);
    // We don't know exact count without requesting it; return 0 to indicate success
    return 0;
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

      // Store the piece at the destination square for capture detection
      const destinationSquare = this.chess.get(to as any);
      const capturedPiece = destinationSquare ? destinationSquare.type : null;

      // Attempt to make the move
      const move = this.chess.move({ from, to, promotion: promotion as any });
      if (!move) {
        return {
          success: false,
          error: "Invalid move",
        };
      }

      const fenAfter = this.chess.fen();
      const pgn = this.chess.pgn();

      // Determine game status
      let gameStatus = "active";
      let winner: "white" | "black" | "draw" | undefined;

      if (this.chess.isCheckmate()) {
        gameStatus = "checkmate";
        winner = player; // The player who just moved wins
      } else if (this.chess.isStalemate()) {
        gameStatus = "stalemate";
        winner = "draw";
      } else if (this.chess.isDraw()) {
        gameStatus = "draw";
        winner = "draw";
      }

      // Record the move and update game in Supabase
      const supabase = ChessService.getClient();
      const isCastling = this.isCastlingMove(from, to);
      const isEnPassant = this.isEnPassantMove(from, to);
      const isPromotion = this.isPromotionMove(from, to);

      // Insert move
      await supabase.from("moves").insert({
        game_id: gameId,
        move_number: moveNumber,
        player,
        move_notation: move.san,
        fen_before: fenBefore,
        fen_after: fenAfter,
        pgn,
        captured_piece: capturedPiece,
        is_check: this.chess.isCheck(),
        is_checkmate: this.chess.isCheckmate(),
        is_castling: isCastling,
        is_en_passant: isEnPassant,
        is_promotion: isPromotion,
      });

      // Update game state
      await supabase
        .from("games")
        .update({
          fen: fenAfter,
          pgn,
          current_player: this.chess.turn() === "w" ? "white" : "black",
          status: gameStatus,
          winner,
          move_count: historyLength + 1,
        })
        .eq("id", gameId);

      return {
        success: true,
        fen: fenAfter,
        pgn,
        san: move.san,
        capturedPiece: capturedPiece || undefined,
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
    return this.chess.moves({ square: square as any, verbose: false });
  }

  // Get all legal moves
  getAllMoves(): string[] {
    return this.chess.moves();
  }

  // Game status methods
  getGameStatus(): {
    isCheck: boolean;
    isCheckmate: boolean;
    isStalemate: boolean;
    isDraw: boolean;
    isGameOver: boolean;
    winner?: "white" | "black" | "draw";
  } {
    return {
      isCheck: this.chess.isCheck(),
      isCheckmate: this.chess.isCheckmate(),
      isStalemate: this.chess.isStalemate(),
      isDraw: this.chess.isDraw(),
      isGameOver: this.chess.isGameOver(),
      winner: this.chess.isCheckmate()
        ? this.chess.turn() === "w"
          ? "black"
          : "white"
        : this.chess.isDraw() || this.chess.isStalemate()
        ? "draw"
        : undefined,
    };
  }

  // Helper methods
  private isCastlingMove(from: string, to: string): boolean {
    // Check if it's a king move of 2 squares
    const fromFile = from.charCodeAt(0);
    const toFile = to.charCodeAt(0);
    const fromRank = from.charCodeAt(1);
    const toRank = to.charCodeAt(1);

    return (
      fromRank === toRank && // Same rank
      Math.abs(fromFile - toFile) === 2 && // 2 squares horizontally
      ((from === "e1" && (to === "g1" || to === "c1")) || // White castling
        (from === "e8" && (to === "g8" || to === "c8"))) // Black castling
    );
  }

  private isEnPassantMove(from: string, to: string): boolean {
    // This is a simplified check - in a real implementation,
    // you'd check if a pawn is moving diagonally to an empty square
    const piece = this.chess.get(from as any);
    return piece?.type === "p" && from.charCodeAt(0) !== to.charCodeAt(0);
  }

  private isPromotionMove(from: string, to: string): boolean {
    const piece = this.chess.get(from as any);
    return (
      piece?.type === "p" &&
      ((piece.color === "w" && to.charCodeAt(1) === "8".charCodeAt(0)) ||
        (piece.color === "b" && to.charCodeAt(1) === "1".charCodeAt(0)))
    );
  }
}
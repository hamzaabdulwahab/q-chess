import { Chess } from "chess.js";
import { getSupabaseServer } from "@/lib/supabase-server";

export class ChessService {
  public chess: Chess;

  constructor(fen?: string) {
    this.chess = new Chess(fen);
  }

  // Create a new game
  static async createNewGame(userId?: string): Promise<number> {
    const supabase = await getSupabaseServer();
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

  // Get game by ID
  static async getGame(
    gameId: number
  ): Promise<
    | (Record<string, unknown> & {
        moves: Record<string, unknown>[];
        totalMoves: number;
      })
    | null
  > {
    const supabase = await getSupabaseServer();
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("*")
      .eq("id", gameId)
      .single();

    if (gameError || !game) {
      return null;
    }

    const { data: moves, error: movesError } = await supabase
      .from("moves")
      .select("*")
      .eq("game_id", gameId)
      .order("move_number", { ascending: true });

    if (movesError) {
      throw new Error(movesError.message);
    }

    return {
      ...(game as Record<string, unknown>),
      moves: (moves as Record<string, unknown>[]) || [],
      totalMoves: moves?.length || 0,
    };
  }

  // Get all games
  static async getAllGames(): Promise<
    (Record<string, unknown> & {
      moves: Record<string, unknown>[];
      totalMoves: number;
    })[]
  > {
    const supabase = await getSupabaseServer();
    const { data: games, error } = await supabase
      .from("games")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const gamesWithMoves = await Promise.all(
      (games || []).map(async (game: Record<string, unknown>) => {
        const { data: moveRows } = await supabase
          .from("moves")
          .select("*")
          .eq("game_id", (game as unknown as { id: number }).id)
          .order("move_number", { ascending: true });

        return {
          ...(game as Record<string, unknown>),
          moves: (moveRows as Record<string, unknown>[]) || [],
          totalMoves: (moveRows?.length as number) || 0,
        };
      })
    );

    return gamesWithMoves;
  }

  // Get games for a specific user
  static async getUserGames(userId: string): Promise<
    (Record<string, unknown> & {
      moves: Record<string, unknown>[];
      totalMoves: number;
    })[]
  > {
    const supabase = await getSupabaseServer();
    const { data: games, error } = await supabase
      .from("games")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const gamesWithMoves = await Promise.all(
      (games || []).map(async (game: Record<string, unknown>) => {
        const { data: moveRows } = await supabase
          .from("moves")
          .select("*")
          .eq("game_id", (game as unknown as { id: number }).id)
          .order("move_number", { ascending: true });

        return {
          ...(game as Record<string, unknown>),
          moves: (moveRows as Record<string, unknown>[]) || [],
          totalMoves: (moveRows?.length as number) || 0,
        };
      })
    );

    return gamesWithMoves;
  }

  // Delete a game
  static async deleteGame(gameId: number): Promise<boolean> {
    const supabase = await getSupabaseServer();
    // Delete moves first (in case no FK cascade)
    await supabase.from("moves").delete().eq("game_id", gameId);
    const { error } = await supabase.from("games").delete().eq("id", gameId);
    return !error;
  }

  // Delete all games
  static async deleteAllGames(): Promise<number> {
    const supabase = getSupabaseServer();
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

      // Record the move and update game in Supabase
      const supabase = getSupabaseServer();
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
        captured_piece: move.captured || null,
        is_check: this.chess.inCheck(),
        is_checkmate: this.chess.isCheckmate(),
        is_castling: isCastling,
        is_en_passant: isEnPassant,
        is_promotion: isPromotion,
      });

      // Update game
      await supabase
        .from("games")
        .update({
          fen: fenAfter,
          pgn,
          status: gameStatus,
          current_player: this.getCurrentTurn(),
          winner: winner || null,
          move_count: this.chess.history().length,
        })
        .eq("id", gameId);

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

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Chess } from "chess.js";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabasePooledClient } from "@/lib/supabase-pooled";

export class ChessService {
  public chess: Chess;

  constructor(fen?: string) {
    this.chess = new Chess(fen);
  }

  private static buildParticipantFilter(userId: string) {
    return `user_id.eq.${userId},white_user_id.eq.${userId},black_user_id.eq.${userId}`;
  }

  private static normalizeUsername(value: string) {
    return value.trim().toLowerCase();
  }

  private static async getParticipantGameState(gameId: number, userId: string) {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("games")
      .select(
        "id, status, current_player, white_user_id, black_user_id, time_control_initial_ms, increment_ms, white_time_left_ms, black_time_left_ms, last_move_at"
      )
      .eq("id", gameId)
      .or(ChessService.buildParticipantFilter(userId))
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data as
      | {
          id: number;
          status: string;
          current_player: "white" | "black";
          white_user_id: string | null;
          black_user_id: string | null;
          time_control_initial_ms: number | null;
          increment_ms: number;
          white_time_left_ms: number | null;
          black_time_left_ms: number | null;
          last_move_at: string | null;
        }
      | null;
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
  static async createNewGame(
    userId?: string,
    options?: {
      whiteUserId?: string;
      blackUserId?: string;
      timeControlInitialMs?: number;
      incrementMs?: number;
    }
  ): Promise<number> {
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

    const timeControlInitialMs = options?.timeControlInitialMs;
    const incrementMs = options?.incrementMs ?? 0;

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
        white_user_id: options?.whiteUserId ?? null,
        black_user_id: options?.blackUserId ?? null,
        time_control_initial_ms: timeControlInitialMs ?? null,
        increment_ms: incrementMs,
        white_time_left_ms: timeControlInitialMs ?? null,
        black_time_left_ms: timeControlInitialMs ?? null,
        started_at: new Date().toISOString(),
        last_move_at: new Date().toISOString(),
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
      .or(ChessService.buildParticipantFilter(userId))
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
      .or(ChessService.buildParticipantFilter(userId));

    // Lightweight query without moves data, just count
    const { data: gamesData, error: gamesError } = await supabase
      .from("games")
      .select(`
        id,
        status,
        current_player,
        winner,
        fen,
        move_count,
        user_id,
        white_user_id,
        black_user_id,
        time_control_initial_ms,
        increment_ms,
        white_time_left_ms,
        black_time_left_ms,
        last_move_at,
        created_at,
        updated_at
      `)
      .or(ChessService.buildParticipantFilter(userId))
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
      .or(ChessService.buildParticipantFilter(userId))
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

  static async searchUsers(query: string, currentUserId: string): Promise<
    { id: string; username: string; full_name: string | null; avatar_url: string | null }[]
  > {
    const normalized = ChessService.normalizeUsername(query);
    if (!normalized || normalized.length < 2) {
      return [];
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .ilike("username", `${normalized}%`)
      .neq("id", currentUserId)
      .order("username", { ascending: true })
      .limit(10);

    if (error) {
      throw new Error(error.message);
    }

    return (data || []) as {
      id: string;
      username: string;
      full_name: string | null;
      avatar_url: string | null;
    }[];
  }

  static async createInvite(
    fromUserId: string,
    toUsername: string,
    options?: { timeControlInitialMs?: number; incrementMs?: number }
  ): Promise<{ id: number; toUserId: string }> {
    const supabase = getSupabaseServer();
    const normalizedUsername = ChessService.normalizeUsername(toUsername);

    const { data: candidateProfiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, username")
      .ilike("username", normalizedUsername)
      .limit(10);

    if (profileError) {
      throw new Error(profileError.message);
    }
    const targetProfile = (candidateProfiles || []).find(
      (profile) =>
        String(profile.username || "").trim().toLowerCase() ===
        normalizedUsername
    );
    if (!targetProfile) {
      throw new Error("User not found");
    }
    if (targetProfile.id === fromUserId) {
      throw new Error("You cannot invite yourself");
    }

    const initialMs = options?.timeControlInitialMs ?? 600000;
    const incrementMs = options?.incrementMs ?? 0;
    if (initialMs < 60000 || initialMs > 1800000) {
      throw new Error("Initial time must be between 1 and 30 minutes");
    }
    if (incrementMs < 0 || incrementMs > 30000) {
      throw new Error("Increment must be between 0 and 30 seconds");
    }

    const { data, error } = await supabase
      .from("invites")
      .insert({
        from_user_id: fromUserId,
        to_user_id: targetProfile.id,
        status: "pending",
        time_control_initial_ms: initialMs,
        increment_ms: incrementMs,
      })
      .select("id, to_user_id")
      .single();

    if (error || !data) {
      if (error?.code === "23505") {
        throw new Error("A pending invite already exists for this user");
      }
      throw new Error(error?.message || "Failed to create invite");
    }

    return {
      id: data.id as number,
      toUserId: data.to_user_id as string,
    };
  }

  static async getInvites(
    userId: string,
    direction: "incoming" | "outgoing" | "all" = "all"
  ) {
    const supabase = getSupabaseServer();

    const nowIso = new Date().toISOString();
    let expireScope = supabase
      .from("invites")
      .update({ status: "expired", responded_at: nowIso })
      .eq("status", "pending")
      .lt("expires_at", nowIso);

    if (direction === "incoming") {
      expireScope = expireScope.eq("to_user_id", userId);
    } else if (direction === "outgoing") {
      expireScope = expireScope.eq("from_user_id", userId);
    } else {
      expireScope = expireScope.or(`to_user_id.eq.${userId},from_user_id.eq.${userId}`);
    }

    await expireScope;

    let query = supabase
      .from("invites")
      .select(`
        id,
        from_user_id,
        to_user_id,
        status,
        time_control_initial_ms,
        increment_ms,
        game_id,
        created_at,
        expires_at,
        responded_at
      `)
      .order("created_at", { ascending: false })
      .limit(50);

    if (direction === "incoming") {
      query = query.eq("to_user_id", userId);
    } else if (direction === "outgoing") {
      query = query.eq("from_user_id", userId);
    } else {
      query = query.or(`to_user_id.eq.${userId},from_user_id.eq.${userId}`);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }
    
    if (!data || data.length === 0) {
      return [];
    }

    // Collect all unique user IDs involved
    const userIds = new Set<string>();
    data.forEach((invite: any) => {
      if (invite.from_user_id) userIds.add(invite.from_user_id);
      if (invite.to_user_id) userIds.add(invite.to_user_id);
    });

    // Fetch profiles for these users
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .in("id", Array.from(userIds));

    const profilesMap = new Map();
    if (profiles) {
      profiles.forEach((p: any) => {
        profilesMap.set(p.id, p);
      });
    }

    // Attach profiles to the invites
    return data.map((invite: any) => ({
      ...invite,
      from_profile: profilesMap.get(invite.from_user_id) || null,
      to_profile: profilesMap.get(invite.to_user_id) || null,
    }));
  }

  static async respondToInvite(
    inviteId: number,
    userId: string,
    action: "accept" | "decline"
  ): Promise<{ inviteId: number; status: string; gameId?: number }> {
    const supabase = getSupabaseServer();
    const nowIso = new Date().toISOString();

    const { data: invite, error: inviteError } = await supabase
      .from("invites")
      .select("id, from_user_id, to_user_id, status, expires_at, time_control_initial_ms, increment_ms")
      .eq("id", inviteId)
      .maybeSingle();

    if (inviteError) {
      throw new Error(inviteError.message);
    }
    if (!invite) {
      throw new Error("Invite not found");
    }
    if (invite.to_user_id !== userId) {
      throw new Error("Only the invited user can respond");
    }
    if (invite.status !== "pending") {
      throw new Error("Invite is no longer pending");
    }
    if (new Date(invite.expires_at as string).getTime() < Date.now()) {
      await supabase
        .from("invites")
        .update({ status: "expired", responded_at: nowIso })
        .eq("id", inviteId)
        .eq("status", "pending");
      throw new Error("Invite has expired");
    }

    if (action === "decline") {
      const { data: declinedRows, error: declineError } = await supabase
        .from("invites")
        .update({ status: "declined", responded_at: nowIso })
        .eq("id", inviteId)
        .eq("status", "pending")
        .eq("to_user_id", userId)
        .select("id");

      if (declineError) {
        throw new Error(declineError.message);
      }
      if (!declinedRows || declinedRows.length === 0) {
        throw new Error("Invite is no longer pending");
      }

      return { inviteId, status: "declined" };
    }

    const assignWhiteToSender = Math.random() >= 0.5;
    const whiteUserId = assignWhiteToSender ? (invite.from_user_id as string) : userId;
    const blackUserId = assignWhiteToSender ? userId : (invite.from_user_id as string);
    const initialMs = invite.time_control_initial_ms as number;
    const incrementMs = invite.increment_ms as number;

    const gameId = await ChessService.createNewGame(userId, {
      whiteUserId,
      blackUserId,
      timeControlInitialMs: initialMs,
      incrementMs,
    });

    const { data: acceptedRows, error: acceptError } = await supabase
      .from("invites")
      .update({
        status: "accepted",
        responded_at: nowIso,
        game_id: gameId,
      })
      .eq("id", inviteId)
      .eq("status", "pending")
      .eq("to_user_id", userId)
      .select("id");

    if (acceptError) {
      throw new Error(acceptError.message);
    }
    if (!acceptedRows || acceptedRows.length === 0) {
      await supabase.from("games").delete().eq("id", gameId);
      throw new Error("Invite is no longer pending");
    }

    return { inviteId, status: "accepted", gameId };
  }

  static async cancelInvite(inviteId: number, userId: string): Promise<void> {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("invites")
      .update({ status: "cancelled", responded_at: new Date().toISOString() })
      .eq("id", inviteId)
      .eq("from_user_id", userId)
      .eq("status", "pending")
      .select("id");

    if (error) {
      throw new Error(error.message);
    }
    if (!data || data.length === 0) {
      throw new Error("Invite is no longer pending");
    }
  }

  // Make a move
  async makeMove(
    gameId: number,
    from: string,
    to: string,
    promotion?: string,
    userId?: string
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
      const actingUserId = userId?.trim();
      if (!actingUserId) {
        return {
          success: false,
          error: "Authentication required",
        };
      }

      const gameState = await ChessService.getParticipantGameState(
        gameId,
        actingUserId
      );
      if (!gameState) {
        return {
          success: false,
          error: "Game not found or access denied",
        };
      }

      if (gameState.status !== "active") {
        return {
          success: false,
          error: "Game is not active",
        };
      }

      const player = this.chess.turn() === "w" ? "white" : "black";
      const isMultiplayerGame =
        !!gameState.white_user_id && !!gameState.black_user_id;

      if (isMultiplayerGame) {
        const actorColor =
          actingUserId === gameState.white_user_id
            ? "white"
            : actingUserId === gameState.black_user_id
            ? "black"
            : null;

        if (!actorColor) {
          return {
            success: false,
            error: "Only participants can make moves",
          };
        }

        if (actorColor !== gameState.current_player || actorColor !== player) {
          return {
            success: false,
            error: "It is not your turn",
          };
        }
      }

      const timedGame =
        gameState.time_control_initial_ms !== null &&
        gameState.white_time_left_ms !== null &&
        gameState.black_time_left_ms !== null;

      const now = Date.now();
      const lastMoveAtMs = gameState.last_move_at
        ? new Date(gameState.last_move_at).getTime()
        : now;
      const elapsedMs = Math.max(0, now - lastMoveAtMs);

      let whiteTimeLeftMs = gameState.white_time_left_ms;
      let blackTimeLeftMs = gameState.black_time_left_ms;
      let movingSideTimeAfterDeduction: number | null = null;

      if (timedGame) {
        if (player === "white") {
          movingSideTimeAfterDeduction = Math.max(
            0,
            (whiteTimeLeftMs as number) - elapsedMs
          );
          whiteTimeLeftMs = movingSideTimeAfterDeduction;
        } else {
          movingSideTimeAfterDeduction = Math.max(
            0,
            (blackTimeLeftMs as number) - elapsedMs
          );
          blackTimeLeftMs = movingSideTimeAfterDeduction;
        }

        if ((movingSideTimeAfterDeduction ?? 0) <= 0) {
          const winner = player === "white" ? "black" : "white";
          const timeoutPayload: Record<string, unknown> = {
            status: "timeout",
            winner,
            ended_at: new Date().toISOString(),
            result_reason: `${player}_time_expired`,
            last_move_at: new Date().toISOString(),
            white_time_left_ms: whiteTimeLeftMs,
            black_time_left_ms: blackTimeLeftMs,
          };

          const timeoutClient = getSupabaseServer();
          const { error: timeoutError } = await timeoutClient
            .from("games")
            .update(timeoutPayload)
            .eq("id", gameId)
            .or(ChessService.buildParticipantFilter(actingUserId));

          if (timeoutError) {
            throw new Error(timeoutError.message);
          }

          return {
            success: false,
            gameStatus: "timeout",
            winner,
            error: "Time has expired",
          };
        }
      }

      const fenBefore = this.chess.fen();
      const historyLength = this.chess.history().length;
      // Chess move numbering: Move 1 = white's 1st move, Move 1 = black's 1st move, Move 2 = white's 2nd move, etc.
      const moveNumber = Math.floor(historyLength / 2) + 1;

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
        // IMPORTANT: `player` is the side that JUST MOVED (the delivering side). chess.turn() is now the side that would move next (the mated side).
        // Winner must therefore be `player` (the mover). We keep current_player below as chess.turn() which equals the loser after mate.
        winner = player;
      } else if (this.chess.isStalemate()) {
        gameStatus = "stalemate";
        winner = "draw";
      } else if (this.chess.isDraw()) {
        gameStatus = "draw";
        winner = "draw";
      }

      // Record the move and update game in Supabase using atomic RPC
      const isCastling = this.isCastlingMove(from, to);
      const isEnPassant = this.isEnPassantMove(from, to);
      const isPromotion = this.isPromotionMove(from, to);

      // Update game state via atomic RPC to reduce latency and race conditions
      const nextTurnColor = this.chess.turn() === "w" ? "white" : "black";
      const rpcClient = getSupabaseServer();
      const { data: rpcResult, error: rpcError } = await rpcClient.rpc("record_move", {
        p_game_id: gameId,
        p_move_number: moveNumber,
        p_player: player,
        p_move_notation: move.san,
        p_fen_before: fenBefore,
        p_fen_after: fenAfter,
        p_pgn: pgn,
        p_captured_piece: capturedPiece,
        p_is_check: this.chess.isCheck(),
        p_is_checkmate: this.chess.isCheckmate(),
        p_is_castling: isCastling,
        p_is_en_passant: isEnPassant,
        p_is_promotion: isPromotion,
        p_current_player: nextTurnColor,
        p_status: gameStatus,
        p_winner: winner ?? null,
        // Remove p_expected_ply to avoid race condition issues
      });

      if (rpcError) {
        console.error("Failed to record move atomically:", rpcError);
        throw new Error(`Database error recording move: ${rpcError.message}`);
      }

      // Check if the RPC function returned an error
      if (rpcResult && !rpcResult.success) {
        console.error("Move rejected by database:", rpcResult.error);
        throw new Error(rpcResult.error || "Move rejected by database");
      }

      if (timedGame) {
        const incrementMs = gameState.increment_ms ?? 0;
        if (player === "white") {
          whiteTimeLeftMs = Math.max(
            0,
            (movingSideTimeAfterDeduction as number) + incrementMs
          );
        } else {
          blackTimeLeftMs = Math.max(
            0,
            (movingSideTimeAfterDeduction as number) + incrementMs
          );
        }

        const gamePatch: Record<string, unknown> = {
          white_time_left_ms: whiteTimeLeftMs,
          black_time_left_ms: blackTimeLeftMs,
          last_move_at: new Date().toISOString(),
        };

        if (gameStatus !== "active") {
          gamePatch.ended_at = new Date().toISOString();
          gamePatch.result_reason = gameStatus;
        }

        const timePatchClient = getSupabaseServer();
        const { error: timePatchError } = await timePatchClient
          .from("games")
          .update(gamePatch)
          .eq("id", gameId)
          .or(ChessService.buildParticipantFilter(actingUserId));

        if (timePatchError) {
          throw new Error(timePatchError.message);
        }
      }

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
    // If checkmate, side to move (turn()) is the LOSER; winner is the opposite color
    let winner: "white" | "black" | "draw" | undefined;
    if (this.chess.isCheckmate()) {
      const loser = this.chess.turn() === 'w' ? 'white' : 'black';
      winner = loser === 'white' ? 'black' : 'white';
    } else if (this.chess.isDraw() || this.chess.isStalemate()) {
      winner = 'draw';
    }
    return {
      isCheck: this.chess.isCheck(),
      isCheckmate: this.chess.isCheckmate(),
      isStalemate: this.chess.isStalemate(),
      isDraw: this.chess.isDraw(),
      isGameOver: this.chess.isGameOver(),
      winner,
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
"use client";

import React, {
  useState,
  useEffect,
  Suspense,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useSearchParams } from "next/navigation";
import { ChessBoard } from "@/components/ChessBoard";
import { GameNavigator } from "@/components/GameNavigator";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DrawOfferBanner } from "@/components/DrawOfferBanner";
import { GameEndScreen, type EndStatus } from "@/components/GameEndScreen";
import { PlayerCard } from "@/components/PlayerCard";
import { ChessLayout } from "@/components/ChessLayout";
import { InGameToolbar } from "@/components/InGameToolbar";
import {
  MoveHistory,
  type MoveHistoryEntry,
} from "@/components/MoveHistory";
import {
  MOVE_BROADCAST_EVENT,
  type MoveBroadcastPayload,
  gameChannelName,
  isMoveBroadcastPayload,
  sendMoveBroadcast,
} from "@/lib/multiplayer/game-channel";
import { isBotLevel, type BotLevel } from "@/lib/stockfish/types";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { ThemeProvider } from "@/lib/theme-context";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { soundManager } from "@/lib/sound-manager";
import { ChessClient } from "@/lib/chess-client";
import {
  ChevronLeft,
  ChevronRight,
  Menu,
  Plus,
  RotateCw,
} from "lucide-react";

type Profile = {
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
};

type MoveRow = {
  move_notation: string;
  player: "white" | "black";
  captured_piece?: string | null;
  is_check?: boolean;
  is_checkmate?: boolean;
  is_castling?: boolean;
  is_en_passant?: boolean;
  is_promotion?: boolean;
  created_at?: string | null;
};

const extractCapturedPieces = (moves: MoveRow[]) => {
  // capturedPieces.white = white-color pieces that were captured (i.e. taken
  // by black). capturedPieces.black = black-color pieces taken by white.
  const captured = { white: [] as string[], black: [] as string[] };
  for (const move of moves) {
    const piece = move.captured_piece;
    if (!piece) continue;
    if (move.player === "white") {
      captured.black.push(piece);
    } else {
      captured.white.push(piece);
    }
  }
  return captured;
};

function BoardContent() {
  const searchParams = useSearchParams();
  const gameId = searchParams.get("id");
  const mode = searchParams.get("mode"); // "remote" or null
  const youColorParam = searchParams.get("you") as "white" | "black" | null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameState, setGameState] = useState({
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    currentTurn: "white" as "white" | "black",
    gameStatus: "active",
    winner: null as "white" | "black" | "draw" | null,
    moveHistory: [] as string[],
    capturedPieces: { white: [] as string[], black: [] as string[] },
  });
  const [skipEndScreen, setSkipEndScreen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<{
    whiteUserId: string | null;
    blackUserId: string | null;
  }>({ whiteUserId: null, blackUserId: null });
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [clocks, setClocks] = useState<{
    whiteTimeLeftMs: number | null;
    blackTimeLeftMs: number | null;
    lastMoveAt: string | null;
  }>({ whiteTimeLeftMs: null, blackTimeLeftMs: null, lastMoveAt: null });
  // Full server-recorded move list (used by MoveHistory; carries timestamps
  // so time-per-move can be derived).
  const [moveRecords, setMoveRecords] = useState<MoveHistoryEntry[]>([]);
  // Latest non-local move (Stockfish or online opponent). Passing this to
  // ChessBoard triggers the same slide-in animation we already play for
  // the local user's own moves. New object per move = new render trigger.
  const [lastOpponentMove, setLastOpponentMove] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const [gameStartedAt, setGameStartedAt] = useState<string | null>(null);
  const [pendingDrawOfferBy, setPendingDrawOfferBy] = useState<string | null>(
    null,
  );
  // Stockfish bot game state. Populated from the game row; null for any
  // non-bot game. The botInFlightRef guards against double-firing while a
  // request is in flight.
  const [botGame, setBotGame] = useState<{
    botSide: "white" | "black";
    botLevel: BotLevel;
  } | null>(null);
  const [isBotThinking, setIsBotThinking] = useState(false);
  const botInFlightRef = useRef(false);
  const [toast, setToast] = useState<string | null>(null);

  // Track previously-seen move count + my own color for opponent-move sound.
  const prevMoveCountRef = useRef<number>(0);
  const myColorRef = useRef<"white" | "black" | null>(null);
  // Current user id mirror — used by broadcast handlers and the outgoing
  // broadcast sender. Keeps the realtime useEffect from re-subscribing on
  // every auth-state tick.
  const currentUserIdRef = useRef<string | null>(null);
  // Holds the active game channel so handleMove can publish outgoing
  // broadcasts without re-creating the channel per move.
  const channelRef = useRef<RealtimeChannel | null>(null);
  // Identity of the last bot turn we've requested an engine move for.
  // Format: "gameId:fenBefore". Used to make the auto-fire effect
  // idempotent without a stuck mutex — each unique board position is
  // requested at most once per browser session.
  const lastBotRequestRef = useRef<string | null>(null);
  // When a human move is optimistic but not yet persisted, hold the bot
  // request until the moves API confirms the commit. This avoids 409 retry
  // loops that make Stockfish feel slow and can replay stale state.
  const botWaitingForHumanCommitRef = useRef<string | null>(null);
  const [botCommitVersion, setBotCommitVersion] = useState(0);
  const supabase = useMemo(() => {
    const sb = getSupabaseBrowser();
    return sb;
  }, []);

  // Auto-dismiss transient toasts after 4 seconds.
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(id);
  }, [toast]);

  // State for access denial dialog
  const [showAccessDialog, setShowAccessDialog] = useState(false);

  // State to control navigator visibility (controlled by keyboard shortcut)
  const [navigatorOpen, setNavigatorOpen] = useState(false);

  // Keep the move-history panel collapsed on every fresh page load.
  const [sidePanelCollapsed, setSidePanelCollapsed] = useState(true);
  const [boardFlipped, setBoardFlipped] = useState(false);
  const toggleSidePanel = useCallback(() => {
    setSidePanelCollapsed((prev) => !prev);
  }, []);

  // Global keyboard shortcut for navigator toggle - always active
  useEffect(() => {
    const handleGlobalKeydown = (ev: KeyboardEvent) => {
      // Handle Cmd+B (Mac) or Ctrl+B (Windows/Linux) to toggle navigator
      if (ev.key === "b" && (ev.metaKey || ev.ctrlKey)) {
        ev.preventDefault();
        setNavigatorOpen(prev => !prev);
        return;
      }
    };

    // Add global listener
    document.addEventListener("keydown", handleGlobalKeydown);
    
    return () => {
      document.removeEventListener("keydown", handleGlobalKeydown);
    };
  }, []); // Empty dependency array - this effect runs once and the listener persists

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!mounted) return;
        if (data.user?.id) {
          setCurrentUserId(data.user.id);
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [supabase]);

  const [gameOver, setGameOver] = useState<null | {
    winner: "white" | "black";
    reason: string;
  }>(null);

  // After an optimistic move, we expect the next turn; use this to ignore stale server snapshots
  const expectedTurnRef = useRef<"white" | "black" | null>(null);
  const expectedFenRef = useRef<string | null>(null);
  const clearExpectedTimerRef = useRef<number | null>(null);
  // Board always auto-rotates by current turn

  // Allow switching to a server game id without requiring a page reload
  const [overrideGameId, setOverrideGameId] = useState<number | null>(null);
  const effectiveGameId: number | null = React.useMemo(() => {
    if (overrideGameId) return overrideGameId;
    if (!gameId) return null;
    const isValidInteger = /^\d+$/.test(gameId);
    return isValidInteger ? parseInt(gameId) : null;
  }, [overrideGameId, gameId]);

  useEffect(() => {
    botWaitingForHumanCommitRef.current = null;
    lastBotRequestRef.current = null;
    botInFlightRef.current = false;
    setIsBotThinking(false);
  }, [effectiveGameId]);

  const startLocalGame = useCallback((): void => {
    // Initialize a local, non-persisted game
    const initialFen =
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    setGameState({
      fen: initialFen,
      currentTurn: "white",
      gameStatus: "active",
      winner: null,
      moveHistory: [],
      capturedPieces: { white: [], black: [] },
    });
    setGameOver(null);
    setSkipEndScreen(false);
    setMoveRecords([]);
    setGameStartedAt(new Date().toISOString());
    setBotGame(null);
    setIsBotThinking(false);
    botWaitingForHumanCommitRef.current = null;
    lastBotRequestRef.current = null;
    setError(null);
    setLoading(false);
    // Drop any id from URL for local mode
    try {
      window.history.replaceState({}, "", "/board");
    } catch {}
  }, []);

  const loadGameData = useCallback(
    async (
      id: number,
      opts?: {
        resetClocks?: boolean; // default true for initial loads
        isOpponentMove?: boolean; // true if this is a subscription update for opponent's move
      },
    ) => {
      try {
        const response = await fetch(`/api/games/${id}`, { cache: "no-store" });
        
        // Check if response is JSON before parsing
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error("Server returned non-JSON response");
        }
        
        const data = await response.json();

        if (response.ok) {
          const rawMoves: MoveRow[] = (data.game.moves ?? []) as MoveRow[];
          // Parse move history to extract captured pieces and move notations
          const moveHistory = rawMoves.map((move) => move.move_notation);
          const capturedPieces = extractCapturedPieces(rawMoves);
          const newMoveCount =
            (data.game.move_count as number) ?? rawMoves.length;

          if (newMoveCount < prevMoveCountRef.current) {
            setLoading(false);
            return;
          }

          // If an optimistic move was just applied, ignore stale initial snapshot
          if (
            expectedFenRef.current &&
            typeof data.game.fen === "string" &&
            data.game.fen.trim() !== expectedFenRef.current.trim()
          ) {
            setLoading(false);
            return;
          }
          if (
            expectedTurnRef.current &&
            data.game.current_player !== expectedTurnRef.current
          ) {
            setLoading(false);
            return;
          }

          const newGameState = {
            fen: data.game.fen,
            currentTurn: data.game.current_player,
            gameStatus: data.game.status,
            winner: (data.game.winner as "white" | "black" | "draw" | null) ?? null,
            moveHistory,
            capturedPieces,
          };

          setParticipants({
            whiteUserId: (data.game.white_user_id as string | null) ?? null,
            blackUserId: (data.game.black_user_id as string | null) ?? null,
          });

          setClocks({
            whiteTimeLeftMs:
              (data.game.white_time_left_ms as number | null) ?? null,
            blackTimeLeftMs:
              (data.game.black_time_left_ms as number | null) ?? null,
            lastMoveAt: (data.game.last_move_at as string | null) ?? null,
          });
          setGameStartedAt(
            (data.game.started_at as string | null) ??
              (data.game.created_at as string | null) ??
              null,
          );
          setMoveRecords(
            rawMoves.map((m) => ({
              move_notation: m.move_notation,
              player: m.player,
              created_at: m.created_at ?? null,
            })),
          );
          setPendingDrawOfferBy(
            (data.game.pending_draw_offer_by as string | null) ?? null,
          );

          // Detect Stockfish bot game from the row.
          if (
            data.game.mode === "human_vs_stockfish" &&
            (data.game.bot_side === "white" || data.game.bot_side === "black") &&
            isBotLevel(data.game.bot_level)
          ) {
            setBotGame({
              botSide: data.game.bot_side,
              botLevel: data.game.bot_level,
            });
          } else {
            setBotGame(null);
          }

          // Detect new opponent moves and play the appropriate sound.
          const lastMove = rawMoves[rawMoves.length - 1];
          if (
            newMoveCount > prevMoveCountRef.current &&
            lastMove &&
            myColorRef.current &&
            lastMove.player !== myColorRef.current
          ) {
            soundManager.playMoveSound({
              isCapture: Boolean(lastMove.captured_piece),
              isCastle: Boolean(lastMove.is_castling),
              isPromotion: Boolean(lastMove.is_promotion),
              isCheck:
                Boolean(lastMove.is_check) && !Boolean(lastMove.is_checkmate),
              isCheckmate: Boolean(lastMove.is_checkmate),
              isIllegal: false,
            });
          }
          prevMoveCountRef.current = newMoveCount;

          // If this reload was triggered right after an optimistic move, ignore stale snapshots
          const wasPostMoveReload = opts?.resetClocks === false;
          if (
            wasPostMoveReload &&
            expectedTurnRef.current &&
            data.game.current_player !== expectedTurnRef.current
          ) {
            return;
          }
          if (
            wasPostMoveReload &&
            expectedFenRef.current &&
            typeof data.game.fen === "string" &&
            data.game.fen.trim() !== expectedFenRef.current.trim()
          ) {
            return;
          }

          setGameState(newGameState);
          // No clocks: just clear local gameOver state on fresh active games
          const isActive = data.game.status === "active";
          if (isActive) setGameOver(null);
          setError(null);

        } else {
          // Check if this is an authentication error
          if (response.status === 401) {
            window.location.href = `/auth/signin?redirectTo=/board${window.location.search}`;
            return;
          }
          
          // Check if game not found - show professional error instead of alert
          if (response.status === 404) {
            // Professional UX: Show custom dialog instead of browser confirm
            setShowAccessDialog(true);
            return;
          }
          
          setError(
            "Unable to sync with server. You can continue playing; moves will sync when connection is back.",
          );
          return;
        }
      } catch (err) {
        console.error(`Error loading game data for ${id}:`, err);
        setError(
          "Game disabled while offline. Connect to the internet to play.",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const createNewGame = useCallback(async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        startLocalGame();
        return;
      }

      setCurrentUserId(user.id);
      const response = await fetch("/api/games", {
        method: "POST",
      });
      
      // Check if response is JSON before parsing
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned non-JSON response");
      }
      
      const data = await response.json();

      if (response.ok) {
        // Update URL with new game ID
        window.history.replaceState({}, "", `/board?id=${data.gameId}`);
        // Set override so child components and sync use new id immediately without reload
        try {
          setOverrideGameId(data.gameId);
        } catch {}
        // Load the game data inline to avoid dependency issues
        try {
          const gameResponse = await fetch(`/api/games/${data.gameId}`, {
            cache: "no-store",
          });
          
          // Check if response is JSON before parsing
          const gameContentType = gameResponse.headers.get("content-type");
          if (!gameContentType || !gameContentType.includes("application/json")) {
            throw new Error("Game data response is not JSON");
          }
          
          const gameData = await gameResponse.json();

          if (gameResponse.ok) {
            const moveHistory = gameData.game.moves.map(
              (move: { move_notation: string }) => move.move_notation,
            );
            const capturedPieces = extractCapturedPieces(gameData.game.moves);

            const newGameState = {
              fen: gameData.game.fen,
              currentTurn: gameData.game.current_player,
              gameStatus: gameData.game.status,
              winner:
                (gameData.game.winner as
                  | "white"
                  | "black"
                  | "draw"
                  | null) ?? null,
              moveHistory,
              capturedPieces,
            };

            setGameState(newGameState);
            setGameOver(null);
            setError(null);
          } else {
            void gameData;
            startLocalGame();
          }
        } catch (err) {
          console.error(`Error loading game data for ${data.gameId}:`, err);
          startLocalGame();
        } finally {
          setLoading(false);
        }
      } else {
        void data;
        startLocalGame();
        setLoading(false);
      }
    } catch (err) {
      console.error("Error creating game:", err);
      // Fallback to local game
      startLocalGame();
    }
  }, [startLocalGame, supabase]);

  // Dialog handlers for access denial
  const handleCreateNewGame = useCallback(async () => {
    setShowAccessDialog(false);
    await createNewGame();
  }, [createNewGame]);

  const handleReturnHome = useCallback(() => {
    setShowAccessDialog(false);
    window.location.href = "/";
  }, []);

  const loadGame = useCallback(
    async (id: number) => {
      // Validate that id is a valid number
      if (!id || isNaN(id) || !Number.isInteger(id) || id <= 0) {
        createNewGame();
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(`/api/games/${id}`, { cache: "no-store" });
        
        // Check if response is JSON before parsing
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error("Server returned non-JSON response");
        }
        
        const data = await response.json();

        if (response.ok) {
          const rawMoves: MoveRow[] = (data.game.moves ?? []) as MoveRow[];
          const moveHistory = rawMoves.map((move) => move.move_notation);
          const capturedPieces = extractCapturedPieces(rawMoves);

          const newGameState = {
            fen: data.game.fen,
            currentTurn: data.game.current_player,
            gameStatus: data.game.status,
            winner: (data.game.winner as "white" | "black" | "draw" | null) ?? null,
            moveHistory,
            capturedPieces,
          };

          setParticipants({
            whiteUserId: (data.game.white_user_id as string | null) ?? null,
            blackUserId: (data.game.black_user_id as string | null) ?? null,
          });

          setClocks({
            whiteTimeLeftMs:
              (data.game.white_time_left_ms as number | null) ?? null,
            blackTimeLeftMs:
              (data.game.black_time_left_ms as number | null) ?? null,
            lastMoveAt: (data.game.last_move_at as string | null) ?? null,
          });
          setGameStartedAt(
            (data.game.started_at as string | null) ??
              (data.game.created_at as string | null) ??
              null,
          );
          setMoveRecords(
            rawMoves.map((m) => ({
              move_notation: m.move_notation,
              player: m.player,
              created_at: m.created_at ?? null,
            })),
          );
          setPendingDrawOfferBy(
            (data.game.pending_draw_offer_by as string | null) ?? null,
          );

          if (
            data.game.mode === "human_vs_stockfish" &&
            (data.game.bot_side === "white" || data.game.bot_side === "black") &&
            isBotLevel(data.game.bot_level)
          ) {
            setBotGame({
              botSide: data.game.bot_side,
              botLevel: data.game.bot_level,
            });
          } else {
            setBotGame(null);
          }

          // Initialise the "last seen move count" so the first load never
          // re-plays the opponent's prior move sound.
          prevMoveCountRef.current =
            (data.game.move_count as number) ?? rawMoves.length;

          setGameState(newGameState);
          if (data.game.status === "active") setGameOver(null);
          setError(null);
        } else {
          // Check if this is an authentication error
          if (response.status === 401) {
            window.location.href = `/auth/signin?redirectTo=/board${window.location.search}`;
            return;
          }
          
          // Check if game not found - show professional error instead of alert
          if (response.status === 404) {
            // Professional UX: Show custom dialog instead of browser confirm
            setShowAccessDialog(true);
            return;
          }
          
          setError("Unable to load latest state. Retrying…");
        }
      } catch (err) {
        void err;
        setError(
          "Game disabled while offline. Connect to the internet to play.",
        );
      } finally {
        setLoading(false);
      }
    },
    [createNewGame],
  );

  useEffect(() => {
    if (gameId) {
      // Check if the entire string is a valid integer (not just the prefix)
      const isValidInteger = /^\d+$/.test(gameId);
      const parsedGameId = parseInt(gameId);

      if (isValidInteger && !isNaN(parsedGameId) && parsedGameId > 0) {
        loadGame(parsedGameId);
      } else {
        createNewGame();
      }
    } else {
      // No game ID provided, create a new game
      createNewGame();
    }
  }, [gameId, createNewGame, loadGame]);

  // Authoritative side to move derived from FEN
  const fenTurn: "white" | "black" = React.useMemo(() => {
    try {
      const c = new ChessClient(gameState.fen);
      return c.getCurrentTurn();
    } catch {
      return (gameState.fen.includes(" w ") ? "white" : "black") as
        | "white"
        | "black";
    }
  }, [gameState.fen]);

  // Board orientation: lock to the player's color whenever the game has two
  // assigned participants (multiplayer). The `mode=remote` URL param is no
  // longer required — clicking a multiplayer game from the archive uses just
  // `?id=N`, and we still want the board pinned and the wrong-turn lock to
  // apply. Local hot-seat games (no participants) keep rotating via fenTurn.
  const remoteColorFromParticipants: "white" | "black" | null = React.useMemo(() => {
    if (!currentUserId) return null;
    if (participants.whiteUserId === currentUserId) return "white";
    if (participants.blackUserId === currentUserId) return "black";
    return null;
  }, [currentUserId, participants.whiteUserId, participants.blackUserId]);

  const isMultiplayerGame =
    participants.whiteUserId !== null && participants.blackUserId !== null;
  const isBotGame = botGame !== null;
  // Games with a fixed colour per side (multiplayer and bot). The board
  // doesn't rotate between turns, and the user can only move on their own
  // turn.
  const isFixedColorGame = isMultiplayerGame || isBotGame;

  const myRemoteColor: "white" | "black" | null = isFixedColorGame
    ? remoteColorFromParticipants ?? youColorParam ?? null
    : mode === "remote"
      ? remoteColorFromParticipants ?? youColorParam ?? null
      : null;

  const baseBoardOrientation: "white" | "black" = myRemoteColor ?? fenTurn;
  const boardOrientation: "white" | "black" = boardFlipped
    ? baseBoardOrientation === "white"
      ? "black"
      : "white"
    : baseBoardOrientation;

  const remoteTurnLocked =
    isFixedColorGame &&
    Boolean(effectiveGameId) &&
    (myRemoteColor ? myRemoteColor !== fenTurn : true);

  // Keep a ref of the local player's color so loadGameData (which has []
  // deps) can detect opponent-vs-self moves without retriggering when the
  // surrounding state changes.
  useEffect(() => {
    myColorRef.current = remoteColorFromParticipants;
  }, [remoteColorFromParticipants]);

  // ── Stockfish auto-move ──────────────────────────────────────────────
  // Whenever the engine's turn comes up in an active bot game, fire a
  // single request to POST /api/games/[id]/bot-move. Idempotent via a
  // signature (gameId + fen): the same board position is never requested
  // twice, but a brand-new position is always requested even if a
  // previous effect cleanup interrupted a prior in-flight call.
  useEffect(() => {
    if (!effectiveGameId || !botGame) return;
    if (gameState.gameStatus !== "active") return;
    if (gameState.currentTurn !== botGame.botSide) return;
    if (botInFlightRef.current) return;
    if (botWaitingForHumanCommitRef.current === gameState.fen) return;
    if (botWaitingForHumanCommitRef.current) {
      botWaitingForHumanCommitRef.current = null;
    }

    const signature = `${effectiveGameId}:${gameState.fen}`;
    if (lastBotRequestRef.current === signature) return;
    lastBotRequestRef.current = signature;

    let cancelled = false;
    botInFlightRef.current = true;
    setIsBotThinking(true);

    interface BotMovePayload {
      ok?: boolean;
      error?: string;
      retryAfterMs?: number;
      san?: string;
      uci?: string;
      from?: string;
      to?: string;
      fen?: string;
      gameStatus?: string;
      winner?: "white" | "black" | "draw" | null;
      currentPlayer?: "white" | "black";
      moveNumber?: number;
    }

    const requestBotMove = async (): Promise<{
      status: number;
      payload: BotMovePayload;
    }> => {
      const r = await fetch(`/api/games/${effectiveGameId}/bot-move`, {
        method: "POST",
        cache: "no-store",
      });
      const p = (await r.json().catch(() => ({}))) as BotMovePayload;
      return { status: r.status, payload: p };
    };

    const retryBotTurn = (delayMs: number, message?: string) => {
      if (cancelled) return;
      if (message) setToast(message);
      if (lastBotRequestRef.current === signature) {
        lastBotRequestRef.current = null;
      }
      window.setTimeout(() => {
        if (!cancelled) setBotCommitVersion((version) => version + 1);
      }, delayMs);
    };

    // The human move is already committed before this runs, so a tiny
    // frame gate keeps the two piece slides visually distinct without
    // adding perceptible bot delay.
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          // Commit gating above should make 409 rare. Keep a short retry
          // window for production replication jitter / cold starts, but do
          // not let it become a stuck bot turn.
          let result = await requestBotMove();
          for (
            let i = 0;
            (result.status === 409 ||
              result.status === 429 ||
              result.status >= 500) &&
            i < 3;
            i++
          ) {
            const retryAfter =
              result.status === 429 && result.payload.retryAfterMs
                ? Math.min(result.payload.retryAfterMs, 1200)
                : result.status === 409
                  ? 120
                  : 240 * (i + 1);
            await new Promise((resolve) => setTimeout(resolve, retryAfter));
            result = await requestBotMove();
          }

          const { status, payload } = result;
          if (status !== 200 || !payload.ok || !payload.fen) {
            if (status === 409) {
              if (effectiveGameId) {
                void loadGameData(effectiveGameId, { resetClocks: false });
              }
              if (lastBotRequestRef.current === signature) {
                lastBotRequestRef.current = null;
              }
              return;
            }
            retryBotTurn(
              status === 429 && payload.retryAfterMs
                ? Math.min(payload.retryAfterMs, 1500)
                : 650,
              payload.error
                ? `Stockfish delayed: ${payload.error}`
                : "Stockfish delayed. Retrying...",
            );
            return;
          }

          setGameState((prev) => ({
            ...prev,
            fen: payload.fen as string,
            currentTurn: payload.currentPlayer ?? prev.currentTurn,
            gameStatus: payload.gameStatus ?? prev.gameStatus,
            winner: payload.winner ?? prev.winner,
            moveHistory: payload.san
              ? [...prev.moveHistory, payload.san]
              : prev.moveHistory,
            capturedPieces: prev.capturedPieces,
          }));

          // Trigger the slide-in animation for Stockfish's move so the
          // user can see which piece just moved.
          if (payload.from && payload.to) {
            setLastOpponentMove({ from: payload.from, to: payload.to });
          }

          // The bot's response IS the new authoritative state. Clear the
          // optimistic-move guards so the upcoming loadGameData (triggered
          // by postgres_changes or our manual refresh below) isn't
          // discarded as "stale".
          expectedFenRef.current = null;
          expectedTurnRef.current = null;
          if (clearExpectedTimerRef.current) {
            window.clearTimeout(clearExpectedTimerRef.current);
            clearExpectedTimerRef.current = null;
          }

          if (payload.san) {
            const san = payload.san;
            setMoveRecords((prev) => [
              ...prev,
              {
                move_notation: san,
                player: botGame.botSide,
                created_at: new Date().toISOString(),
              },
            ]);
          }
          if (typeof payload.moveNumber === "number") {
            prevMoveCountRef.current = payload.moveNumber;
          }

          // Belt-and-suspenders authoritative resync. The postgres_changes
          // refresh may or may not fire (publication, network); a manual
          // reload guarantees moveRecords reflects DB truth (both the
          // user's move AND the bot's move with correct timestamps).
          if (effectiveGameId) {
            window.setTimeout(() => {
              loadGameData(effectiveGameId, { resetClocks: false });
            }, 80);
          }

          // Derive sound flags from SAN. Good enough for the listener,
          // and accurate for capture / check / checkmate / promotion.
          const san = payload.san ?? "";
          const isCheckmate = san.endsWith("#");
          soundManager.playMoveSound({
            isCapture: san.includes("x"),
            isCastle: san === "O-O" || san === "O-O-O",
            isPromotion: san.includes("="),
            isCheck: !isCheckmate && san.endsWith("+"),
            isCheckmate,
            isIllegal: false,
          });
        } catch {
          retryBotTurn(700, "Stockfish request failed. Retrying...");
        } finally {
          if (!cancelled) {
            botInFlightRef.current = false;
            setIsBotThinking(false);
          }
        }
      })();
    }, 40);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      // Reset the in-flight flag synchronously so a re-render that
      // changes the deps (e.g. game id swap) doesn't see a stuck mutex.
      botInFlightRef.current = false;
      setIsBotThinking(false);
    };
  }, [
    effectiveGameId,
    botGame,
    botCommitVersion,
    gameState.gameStatus,
    gameState.currentTurn,
    gameState.fen,
    loadGameData,
  ]);

  // Mirror currentUserId into a ref so the broadcast handler can validate
  // the message origin without re-subscribing whenever the user object
  // hydrates.
  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  // Fetch profiles for participants so we can render avatars and usernames.
  useEffect(() => {
    const ids = [participants.whiteUserId, participants.blackUserId].filter(
      (id): id is string => typeof id === "string" && id.length > 0,
    );
    if (ids.length === 0) {
      setProfiles({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .in("id", ids);
      if (cancelled || error || !data) return;
      const map: Record<string, Profile> = {};
      for (const row of data as Array<{
        id: string;
        username: string;
        full_name: string | null;
        avatar_url: string | null;
      }>) {
        map[row.id] = {
          username: row.username,
          fullName: row.full_name,
          avatarUrl: row.avatar_url,
        };
      }
      setProfiles(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [participants.whiteUserId, participants.blackUserId, supabase]);

  const isGameOver = gameState.gameStatus !== "active";

  // Opponent identity — only needed to label the DrawOfferBanner and to
  // distinguish my draw offer from theirs.
  const opponentColor: "white" | "black" | null = remoteColorFromParticipants
    ? remoteColorFromParticipants === "white"
      ? "black"
      : "white"
    : null;
  const opponentUserId =
    opponentColor === "white"
      ? participants.whiteUserId
      : opponentColor === "black"
        ? participants.blackUserId
        : null;
  const opponentUsername =
    opponentUserId && profiles[opponentUserId]
      ? profiles[opponentUserId].username
      : null;

  const drawOfferFromOpponent =
    pendingDrawOfferBy != null &&
    opponentUserId != null &&
    pendingDrawOfferBy === opponentUserId;
  const drawOfferFromMe =
    pendingDrawOfferBy != null &&
    currentUserId != null &&
    pendingDrawOfferBy === currentUserId;

  // Helpers for the side-panel layout. Bottom-of-board is the local
  // player's color (or white in local hot-seat). Captures: capturedPieces
  // is keyed by the COLOR that was captured, so a player's own captures
  // are the opposite color's bucket.
  const bottomColor: "white" | "black" = boardOrientation;
  const topColor: "white" | "black" =
    boardOrientation === "white" ? "black" : "white";
  const profileFor = (color: "white" | "black"): Profile | null => {
    const id =
      color === "white" ? participants.whiteUserId : participants.blackUserId;
    return id ? profiles[id] ?? null : null;
  };
  const userIdFor = (color: "white" | "black"): string | null =>
    color === "white" ? participants.whiteUserId : participants.blackUserId;
  const timeFor = (color: "white" | "black"): number | null =>
    color === "white" ? clocks.whiteTimeLeftMs : clocks.blackTimeLeftMs;
  const capturedFor = (color: "white" | "black"): string[] =>
    color === "white"
      ? gameState.capturedPieces.black
      : gameState.capturedPieces.white;

  const handleMove = async (result: {
    success: boolean;
    fen: string;
    gameStatus?: string;
    move?: string;
    from?: string;
    to?: string;
    promotion?: string;
    isCapture?: boolean;
    isCheck?: boolean;
    isCheckmate?: boolean;
    isCastling?: boolean;
    isPromotion?: boolean;
  }) => {
    if (result.success && !gameOver) {
      const isEnd = Boolean(
        result.gameStatus && result.gameStatus !== "active",
      );
      // Derive next-to-move from FEN for authoritative turn
      const fenTurn: "white" | "black" = (() => {
        const parts = result.fen?.trim().split(/\s+/) ?? [];
        return parts[1] === "w" ? "white" : "black";
      })();
      // If game ended on this move, keep the mover (opposite of FEN) at bottom
      const appliedTurn: "white" | "black" = isEnd
        ? fenTurn === "white"
          ? "black"
          : "white"
        : fenTurn;
      // Track expected server state to avoid accepting stale snapshots
      expectedTurnRef.current = isEnd ? null : fenTurn;
      expectedFenRef.current = result.fen;
      if (clearExpectedTimerRef.current) {
        window.clearTimeout(clearExpectedTimerRef.current);
      }
      clearExpectedTimerRef.current = window.setTimeout(() => {
        expectedTurnRef.current = null;
        expectedFenRef.current = null;
      }, 3000);

      if (!isEnd && botGame?.botSide === fenTurn) {
        botWaitingForHumanCommitRef.current = result.fen;
      }

      const optimisticWinner: "white" | "black" | "draw" | null = isEnd
        ? result.gameStatus === "checkmate"
          ? appliedTurn === "white"
            ? "white"
            : "black"
          : "draw"
        : null;

      setGameState((prev) => ({
        fen: result.fen,
        currentTurn: appliedTurn,
        gameStatus: result.gameStatus || "active",
        winner: optimisticWinner ?? prev.winner,
        moveHistory: [
          ...prev.moveHistory,
          ...(result.move ? [result.move] : []),
        ],
        capturedPieces: prev.capturedPieces, // Would update based on captures
      }));

      // Append to the move-history side panel optimistically so the latest
      // move appears immediately. The server reload (or postgres_changes
      // fallback) will reconcile with the canonical record.
      //
      // `appliedTurn` is the side to move NEXT once the game continues, so
      // the player who actually just made the move is the opposite (or
      // equal to appliedTurn when the move ended the game — `appliedTurn`
      // is biased toward keeping the mover at the bottom of the board in
      // that case).
      const playerThatMoved: "white" | "black" = isEnd
        ? appliedTurn
        : fenTurn === "white"
          ? "black"
          : "white";
      if (result.move) {
        setMoveRecords((prev) => [
          ...prev,
          {
            move_notation: result.move as string,
            player: playerThatMoved,
            created_at: new Date().toISOString(),
          },
        ]);
      }

      // Publish the move on the game's Realtime Broadcast channel so the
      // opponent's board updates in ~50ms (rather than waiting for the DB
      // round-trip → postgres_changes → fetch fallback path). The DB
      // persistence kicked off by ChessBoard.persistMove still proceeds in
      // parallel and remains the source of truth.
      if (
        channelRef.current &&
        effectiveGameId &&
        isMultiplayerGame &&
        currentUserIdRef.current &&
        result.from &&
        result.to &&
        result.move
      ) {
        const newMoveNumber = prevMoveCountRef.current + 1;
        // Optimistically advance our seen-count so the postgres_changes
        // echo of our own move (or a reflected broadcast, were one to
        // arrive) is treated as already-known.
        prevMoveCountRef.current = newMoveNumber;
        const payload: MoveBroadcastPayload = {
          gameId: effectiveGameId,
          moveNumber: newMoveNumber,
          player: playerThatMoved,
          playerId: currentUserIdRef.current,
          from: result.from,
          to: result.to,
          promotion: result.promotion,
          san: result.move,
          fenAfter: result.fen,
          isCheck: Boolean(result.isCheck),
          isCheckmate: Boolean(result.isCheckmate),
          isCastling: Boolean(result.isCastling),
          isPromotion: Boolean(result.isPromotion),
          isCapture: Boolean(result.isCapture),
          gameStatus: result.gameStatus || "active",
          createdAt: new Date().toISOString(),
        };
        void sendMoveBroadcast(channelRef.current, payload).catch((err) => {
          void err;
        });
      }

      // If the game ended on this move, surface a local end-state banner.
      // The DB write (status / winner / final FEN) happens atomically inside
      // the record_move RPC fired by ChessBoard.persistMove → POST
      // /api/games/[id]/moves. Do NOT fire a separate PATCH here — it used
      // to race record_move and flip the row to 'checkmate' before the move
      // could commit, which caused the move POST to fail with
      // "Game is not active" and the client to revert the mating move
      // (queen-stayed-on-f5 bug).
      if (isEnd) {
        const winner =
          result.gameStatus === "checkmate"
            ? appliedTurn === "white"
              ? "white" // appliedTurn was the mover; mover delivered mate
              : "black"
            : ("draw" as unknown as "white" | "black");
        setGameOver({
          winner:
            result.gameStatus === "checkmate" ? winner : gameState.currentTurn,
          reason:
            result.gameStatus === "checkmate"
              ? "Checkmate"
              : result.gameStatus === "stalemate"
                ? "Stalemate"
                : "Draw",
        });
      }

      // No proactive loadGameData here: the postgres_changes subscription
      // and the realtime broadcast already drive the authoritative
      // reconciliation. A redundant fetch at 250 ms used to race the
      // user's own POST commit — if the server hadn't persisted yet,
      // loadGameData would briefly paint the OLD position before the
      // committed row showed up, producing the visible undo→redo.
    }
  };

  const handleMoveCommitted = useCallback(
    (result: { fen: string }) => {
      if (botWaitingForHumanCommitRef.current === result.fen) {
        botWaitingForHumanCommitRef.current = null;
        setBotCommitVersion((version) => version + 1);
      }
    },
    [],
  );

  const handleMoveRejected = useCallback(
    (result: { reason: string }) => {
      botWaitingForHumanCommitRef.current = null;
      expectedFenRef.current = null;
      expectedTurnRef.current = null;
      if (clearExpectedTimerRef.current) {
        window.clearTimeout(clearExpectedTimerRef.current);
        clearExpectedTimerRef.current = null;
      }
      setToast(`Move rejected: ${result.reason}`);
      if (effectiveGameId) {
        void loadGameData(effectiveGameId, { resetClocks: false });
      }
    },
    [effectiveGameId, loadGameData],
  );

  const resetGame = async () => {
    // Immediate local reset for responsiveness
    startLocalGame();
    // Attempt server-side new game in background if there was an id
    try {
      if (gameId) {
        await fetch(`/api/games?id=${gameId}`, { method: "DELETE" });
      }
      await createNewGame();
    } catch {
    }
  };

  const [isOnline, setIsOnline] = useState<boolean>(true);

  // Track online/offline status for clean game disabling
  useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  // Apply an opponent's move that arrived over the Realtime Broadcast
  // channel. The DB is still the source of truth — the matching
  // postgres_changes event will fire shortly after and trigger a full
  // loadGameData, which corrects anything this fast-path got wrong. This
  // handler exists only to make the opponent's move appear instantly.
  const applyOpponentMove = useCallback(
    (payload: MoveBroadcastPayload) => {
      // Reject anything for a different game.
      if (payload.gameId !== effectiveGameId) return;
      // Defense-in-depth: `self: false` on the channel means we shouldn't
      // receive our own broadcasts, but just in case.
      if (
        currentUserIdRef.current &&
        payload.playerId === currentUserIdRef.current
      ) {
        return;
      }
      // Dedup by move number. If we've already seen this move (e.g. via a
      // page reload that pulled it from the DB before the broadcast
      // arrived), ignore.
      if (payload.moveNumber <= prevMoveCountRef.current) {
        return;
      }

      const status = payload.gameStatus || "active";
      const winnerFromPayload: "white" | "black" | "draw" | null =
        status === "checkmate"
          ? payload.player
          : status === "stalemate" || status === "draw"
            ? "draw"
            : null;

      setGameState((prev) => ({
        ...prev,
        fen: payload.fenAfter,
        currentTurn: payload.player === "white" ? "black" : "white",
        gameStatus: status,
        winner: winnerFromPayload ?? prev.winner,
        moveHistory: [...prev.moveHistory, payload.san],
        // capturedPieces is rebuilt from the moves table on the next
        // /api/games/[id] reload (triggered by postgres_changes fallback).
        capturedPieces: prev.capturedPieces,
      }));

      // Trigger the slide-in animation for the opponent's move.
      setLastOpponentMove({ from: payload.from, to: payload.to });

      // Append the opponent's move to the move-history side panel.
      setMoveRecords((prev) => [
        ...prev,
        {
          move_notation: payload.san,
          player: payload.player,
          created_at: payload.createdAt ?? new Date().toISOString(),
        },
      ]);

      // Move sound for the opponent's move.
      soundManager.playMoveSound({
        isCapture: payload.isCapture,
        isCastle: payload.isCastling,
        isPromotion: payload.isPromotion,
        isCheck: payload.isCheck && !payload.isCheckmate,
        isCheckmate: payload.isCheckmate,
        isIllegal: false,
      });

      prevMoveCountRef.current = payload.moveNumber;
    },
    [effectiveGameId],
  );

  // Realtime channel for this specific game. Layers Broadcast (instant
  // opponent moves) on top of postgres_changes (DB-backed fallback so a
  // dropped broadcast can't leave a board permanently out of sync).
  useEffect(() => {
    if (!effectiveGameId) return;

    const channel = supabase
      .channel(gameChannelName(effectiveGameId), {
        config: { broadcast: { self: false, ack: false } },
      })
      .on(
        "broadcast",
        { event: MOVE_BROADCAST_EVENT },
        ({ payload }) => {
          if (!isMoveBroadcastPayload(payload)) {
            return;
          }
          applyOpponentMove(payload);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `id=eq.${effectiveGameId}`,
        },
        () => {
          // Authoritative resync. Cheap because the API route is
          // no-store and the response is small.
          loadGameData(effectiveGameId, { resetClocks: false });
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [effectiveGameId, loadGameData, supabase, applyOpponentMove]);

  // Memoize the navigator open change callback to prevent unnecessary re-renders
  const handleNavigatorOpenChange = useCallback((open: boolean) => {
    setNavigatorOpen(open);
  }, []);

  // Do not block the board on non-fatal errors; show inline banners instead

  return (
    <ChessLayout variant="game" showHeader={false}>
      <div className="min-h-screen text-white flex flex-col pb-12 overflow-x-hidden" style={{ backgroundColor: '#141414' }}>
      <div className="container mx-auto px-4 py-4 flex-0">
        {/* Clean offline status indicator - styled dialog matching theme */}
        <div className="mb-2 flex items-center gap-3 text-sm text-gray-300">
          {error && (
            <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-red-300">
              <span className="w-2 h-2 rounded-full bg-red-400" /> {error}
            </span>
          )}
        </div>

        {/* Styled offline dialog matching ConfirmDialog theme */}
        {!isOnline && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="offline-title"
            aria-describedby="offline-message"
          >
            <div 
              className="relative max-w-md w-full rounded-lg shadow-2xl border transform transition-all duration-200 ease-out scale-100"
              style={{ 
                backgroundColor: '#1a1a1a',
                borderColor: '#333',
              }}
            >
              {/* Header */}
              <div className="px-6 pt-6 pb-4">
                <h3 
                  id="offline-title"
                  className="text-lg font-semibold text-white"
                >
                  Game Disabled - No Internet
                </h3>
              </div>

              {/* Content */}
              <div className="px-6 pb-6">
                <p 
                  id="offline-message"
                  className="text-gray-300 leading-relaxed"
                >
                  The game is temporarily disabled while offline to ensure your moves are properly saved.
                </p>
                
                <ul className="mt-4 space-y-2">
                  <li 
                    className="text-sm text-gray-400 flex items-start"
                  >
                    <span className="mr-2 text-gray-500">•</span>
                    Connect to the internet to resume playing
                  </li>
                  <li 
                    className="text-sm text-gray-400 flex items-start"
                  >
                    <span className="mr-2 text-gray-500">•</span>
                    Your current game progress is safely preserved
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
      <div
        className={`flex-1 flex items-start justify-center px-3 py-4 overflow-x-hidden transition-[padding] duration-[250ms] ease-out sm:px-4 ${
          sidePanelCollapsed ? "" : "sm:pr-[296px]"
        }`}
      >
        <div className="flex w-full max-w-[1180px] flex-col items-center gap-4 lg:justify-center">
          {/* Main column: toast, draw banner, board with chess.com-style
              player rows directly above and below it. */}
          <div className="board-area-with-panels flex w-full min-w-0 flex-1 flex-col items-center gap-3">
            {toast && (
              <div
                className="rounded-md px-3 py-2 text-sm"
                style={{
                  background: "var(--danger-soft)",
                  color: "var(--text)",
                  border:
                    "1px solid color-mix(in oklch, var(--danger) 40%, transparent)",
                }}
                role="alert"
              >
                {toast}
              </div>
            )}

            {drawOfferFromOpponent && effectiveGameId && (
              <DrawOfferBanner
                gameId={effectiveGameId}
                offererUsername={opponentUsername}
                onError={(msg) => setToast(msg)}
              />
            )}

            <div className="flex flex-1 items-start justify-center min-w-0">
              <div className="board-stack flex w-full flex-col items-center gap-1">
                <div className="w-full">
                  <PlayerCard
                    username={
                      botGame && botGame.botSide === topColor
                        ? "Stockfish"
                        : profileFor(topColor)?.username ?? null
                    }
                    fullName={profileFor(topColor)?.fullName}
                    avatarUrl={
                      botGame && botGame.botSide === topColor
                        ? null
                        : profileFor(topColor)?.avatarUrl
                    }
                    color={topColor}
                    isYou={
                      isFixedColorGame &&
                      userIdFor(topColor) === currentUserId
                    }
                    isActive={
                      gameState.currentTurn === topColor &&
                      gameState.gameStatus === "active"
                    }
                    isClockFrozen={isGameOver}
                    timeLeftMs={timeFor(topColor)}
                    lastSyncAt={clocks.lastMoveAt}
                    capturedPieces={capturedFor(topColor)}
                    opponentCapturedPieces={capturedFor(bottomColor)}
                  />
                </div>

                <ChessBoard
                  gameId={effectiveGameId ?? undefined}
                  fen={gameState.fen}
                  onMove={handleMove}
                  onMoveCommitted={handleMoveCommitted}
                  onMoveRejected={handleMoveRejected}
                  disabled={
                    loading ||
                    gameState.gameStatus !== "active" ||
                    Boolean(gameOver) ||
                    !isOnline ||
                    remoteTurnLocked ||
                    isBotThinking
                  }
                  orientation={boardOrientation}
                  turn={fenTurn}
                  hideEndScreen={isFixedColorGame}
                  externalLastMove={lastOpponentMove}
                  currentMoveCount={gameState.moveHistory.length}
                />

                <div className="w-full">
                  <PlayerCard
                    username={
                      botGame && botGame.botSide === bottomColor
                        ? "Stockfish"
                        : profileFor(bottomColor)?.username ?? null
                    }
                    fullName={profileFor(bottomColor)?.fullName}
                    avatarUrl={
                      botGame && botGame.botSide === bottomColor
                        ? null
                        : profileFor(bottomColor)?.avatarUrl
                    }
                    color={bottomColor}
                    isYou={
                      isFixedColorGame &&
                      userIdFor(bottomColor) === currentUserId
                    }
                    isActive={
                      gameState.currentTurn === bottomColor &&
                      gameState.gameStatus === "active"
                    }
                    isClockFrozen={isGameOver}
                    timeLeftMs={timeFor(bottomColor)}
                    lastSyncAt={clocks.lastMoveAt}
                    capturedPieces={capturedFor(bottomColor)}
                    opponentCapturedPieces={capturedFor(topColor)}
                  />
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
      <aside
        className={`fixed bottom-0 right-0 top-0 z-40 flex h-screen min-h-screen w-[280px] flex-col border-l bg-[#111] text-white shadow-2xl transition-transform duration-[250ms] ease-out ${
          sidePanelCollapsed ? "translate-x-full" : "translate-x-0"
        }`}
        style={{ borderColor: "rgba(255,255,255,0.08)" }}
        aria-label="Move history"
      >
        <div className="min-h-0 flex-1">
          <MoveHistory moves={moveRecords} startedAt={gameStartedAt} />
        </div>
        <footer
          className="shrink-0 space-y-3 border-t border-white/10 bg-[#111] p-3"
          aria-label="Game actions"
        >
          {isMultiplayerGame && effectiveGameId && !isGameOver && (
            <InGameToolbar
              gameId={effectiveGameId}
              canResign={true}
              canOfferDraw={!drawOfferFromOpponent}
              drawOfferPendingByMe={drawOfferFromMe}
              onError={(msg) => setToast(msg)}
            />
          )}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={resetGame}
              className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full border border-white/15 bg-white/[0.03] px-2 py-2 text-xs font-medium text-gray-100 transition-colors hover:border-white/25 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">New</span>
            </button>
            <button
              type="button"
              onClick={() => setBoardFlipped((value) => !value)}
              className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full border border-white/15 bg-white/[0.03] px-2 py-2 text-xs font-medium text-gray-100 transition-colors hover:border-white/25 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
            >
              <RotateCw className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Flip</span>
            </button>
            <button
              type="button"
              onClick={() => setNavigatorOpen(true)}
              className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full border border-white/15 bg-white/[0.03] px-2 py-2 text-xs font-medium text-gray-100 transition-colors hover:border-white/25 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
            >
              <Menu className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Menu</span>
            </button>
          </div>
        </footer>
      </aside>
      <button
        type="button"
        onClick={toggleSidePanel}
        className={`fixed top-4 z-50 grid h-10 w-7 place-items-center rounded-l-md border-y border-l border-white/10 bg-[#111] text-gray-200 shadow-lg transition-[right,background-color,color] duration-[250ms] ease-out hover:bg-[#1a1a1a] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 ${
          sidePanelCollapsed ? "right-0" : "right-[280px]"
        }`}
        aria-label={sidePanelCollapsed ? "Open move history" : "Hide move history"}
        aria-expanded={!sidePanelCollapsed}
        title={sidePanelCollapsed ? "Open move history" : "Hide move history"}
      >
        {sidePanelCollapsed ? (
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
      </div>
      {/* Slide-out navigator - always mounted but controlled by state */}
      <GameNavigator
        open={navigatorOpen}
        onOpenChange={handleNavigatorOpenChange}
        showButton={false}
        onNewGame={(choice) => {
          if (choice === "local-2v2") {
            resetGame();
          }
        }}
        onStartRemoteGame={(acceptedGameId) => {
          setOverrideGameId(acceptedGameId);
          window.history.replaceState(
            {},
            "",
            `/board?id=${acceptedGameId}&mode=remote`
          );
          loadGame(acceptedGameId);
        }}
        gameActions={
          isMultiplayerGame && effectiveGameId && !isGameOver
            ? {
                gameId: effectiveGameId,
                isActive: true,
                drawOfferFromMe,
                drawOfferFromOpponent,
                onError: (msg) => setToast(msg),
              }
            : undefined
        }
      />

      {/* Access denial dialog */}
      <ConfirmDialog
        isOpen={showAccessDialog}
        title="Game Access Denied"
        message="This game is private or doesn't exist."
        confirmText="Create New Game"
        cancelText="Return Home"
        onConfirm={handleCreateNewGame}
        onCancel={handleReturnHome}
        details={[
          "Click 'Create New Game' to start a new game",
          "Click 'Return Home' to go back to the main page"
        ]}
      />

      {/* End-game fullscreen modal — shared with local hot-seat games.
       * Driven by the server-authoritative gameStatus/winner so it works
       * for every end-state (checkmate, stalemate, draw, resignation,
       * timeout, abandonment) in multiplayer, not just chess-rule
       * endings. ChessBoard's own internal modal is suppressed via
       * hideEndScreen={isMultiplayerGame} so we don't render two. */}
      {isFixedColorGame &&
        isGameOver &&
        !skipEndScreen &&
        effectiveGameId && (
          <GameEndScreen
            status={gameState.gameStatus as EndStatus}
            winner={gameState.winner}
            myColor={remoteColorFromParticipants}
            opponentUsername={
              botGame
                ? "Stockfish"
                : opponentUsername
            }
            gameId={effectiveGameId}
            onDismiss={() => setSkipEndScreen(true)}
          />
        )}
    </ChessLayout>
  );
}

function BoardWithTheme() {
  const searchParams = useSearchParams();
  const gameId = searchParams.get("id");
  
  return (
    <ThemeProvider gameId={gameId}>
      <BoardContent />
    </ThemeProvider>
  );
}

export default function Board() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <BoardWithTheme />
    </Suspense>
  );
}

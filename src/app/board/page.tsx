"use client";

import React, {
  useState,
  useEffect,
  Suspense,
  useCallback,
  useRef,
} from "react";
import { useSearchParams } from "next/navigation";
import { ChessBoard } from "@/components/ChessBoard";
import { GameNavigator } from "@/components/GameNavigator";
import { LoadingSpinner } from "@/components/LoadingSpinner";
// no NewGameChoice needed
// useRouter no longer needed after removing online redirect
// MemeRotator and YouTubeMiniPlayer removed by request
import { ChessClient } from "@/lib/chess-client";

const extractCapturedPieces = (
  moves: Array<{ move_notation: string; player: string }>,
) => {
  // This is a simplified version - in a real implementation,
  // you'd track captures more accurately
  const captured = { white: [] as string[], black: [] as string[] };

  moves.forEach((move) => {
    // Check if move notation indicates capture (contains 'x')
    if (move.move_notation.includes("x")) {
      // This is simplified - you'd need more logic to determine what piece was captured
      const piece = "p"; // placeholder
      if (move.player === "white") {
        captured.black.push(piece);
      } else {
        captured.white.push(piece);
      }
    }
  });

  return captured;
};

function BoardContent() {
  const searchParams = useSearchParams();
  const gameId = searchParams.get("id");
  const mode = searchParams.get("mode"); // "remote" or null
  const youColorParam = searchParams.get("you") as "white" | "black" | null;
  // router removed

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameState, setGameState] = useState({
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    currentTurn: "white" as "white" | "black",
    gameStatus: "active",
    moveHistory: [] as string[],
    capturedPieces: { white: [] as string[], black: [] as string[] },
  });

  // State to track if cursor is over the chess board (for hiding navigator)
  const [isBoardHovered, setIsBoardHovered] = useState(false);
  
  // State to control navigator visibility (controlled by keyboard shortcut)
  const [navigatorOpen, setNavigatorOpen] = useState(false);

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

  // Effect to handle chess board hover detection
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Find chess board elements by their CSS classes
      const boardElement = document.querySelector('.chess-board-large');
      const boardOrientElement = document.querySelector('.board-orient');
      
      if (boardElement && boardOrientElement) {
        const rect = boardOrientElement.getBoundingClientRect();
        const isOverBoard = (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        );
        setIsBoardHovered(isOverBoard);
      }
    };

    // Add event listener to document to track mouse position globally
    document.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Timers removed
  const [gameOver, setGameOver] = useState<null | {
    winner: "white" | "black";
    reason: string;
  }>(null);
  // Vs Computer removed
  // no timer hydration needed
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

  const startLocalGame = useCallback((): void => {
    // Initialize a local, non-persisted game
    const initialFen =
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    setGameState({
      fen: initialFen,
      currentTurn: "white",
      gameStatus: "active",
      moveHistory: [],
      capturedPieces: { white: [], black: [] },
    });
    setGameOver(null);
    setError(null);
    setLoading(false);
    // Drop any id from URL for local mode
    try {
      window.history.replaceState({}, "", "/board");
    } catch {}

    // Hydrate from offline queue so moves persist across reloads while offline
    try {
      const key = "queuedMoves:offline";
      const raw = localStorage.getItem(key);
      if (raw) {
        const queue: Array<{
          from: string;
          to: string;
          promotion: string | null;
          ts: number;
          san?: string;
        }> = JSON.parse(raw);
        if (Array.isArray(queue) && queue.length > 0) {
          const c = new ChessClient(initialFen);
          for (const m of queue) {
            // Best-effort apply; ignore any invalid
            const ok = c.isMoveLegal(m.from, m.to, m.promotion ?? undefined);
            if (ok) {
              c.makeMove(m.from, m.to, m.promotion ?? undefined);
            }
          }
          const status = c.getGameStatus();
          setGameState({
            fen: c.getFen(),
            currentTurn: c.getCurrentTurn(),
            gameStatus: status.isCheckmate
              ? "checkmate"
              : status.isStalemate
                ? "stalemate"
                : status.isDraw
                  ? "draw"
                  : "active",
            moveHistory: c.getHistory(),
            capturedPieces: c.getCapturedPieces(),
          });
        }
      }
    } catch {}
  }, []);

  const loadGameData = useCallback(
    async (
      id: number,
      opts?: {
        resetClocks?: boolean; // default true for initial loads
      },
    ) => {
      try {
        console.log(`Loading game data for ${id}...`);
        const response = await fetch(`/api/games/${id}`);
        
        // Check if response is JSON before parsing
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Server returned non-JSON response');
        }
        
        const data = await response.json();

        console.log(`Game ${id} data response:`, response.status, data);

        if (response.ok) {
          // Parse move history to extract captured pieces and move notations
          const moveHistory = data.game.moves.map(
            (move: { move_notation: string }) => move.move_notation,
          );
          const capturedPieces = extractCapturedPieces(data.game.moves);

          // If an optimistic move was just applied, ignore stale initial snapshot
          if (
            expectedFenRef.current &&
            typeof data.game.fen === "string" &&
            data.game.fen.trim() !== expectedFenRef.current.trim()
          ) {
            console.log("Ignoring stale initial snapshot (fen)");
            setLoading(false);
            return;
          }
          if (
            expectedTurnRef.current &&
            data.game.current_player !== expectedTurnRef.current
          ) {
            console.log(
              "Ignoring stale initial snapshot (turn)",
              data.game.current_player,
              "!= expected",
              expectedTurnRef.current,
            );
            setLoading(false);
            return;
          }

          const newGameState = {
            fen: data.game.fen,
            currentTurn: data.game.current_player,
            gameStatus: data.game.status,
            moveHistory,
            capturedPieces,
          };

          // If this reload was triggered right after an optimistic move, ignore stale snapshots
          const wasPostMoveReload = opts?.resetClocks === false;
          if (
            wasPostMoveReload &&
            expectedTurnRef.current &&
            data.game.current_player !== expectedTurnRef.current
          ) {
            console.log(
              "Ignoring stale game snapshot (turn)",
              data.game.current_player,
              "!= expected",
              expectedTurnRef.current,
            );
            return; // don't overwrite local optimistic state
          }
          if (
            wasPostMoveReload &&
            expectedFenRef.current &&
            typeof data.game.fen === "string" &&
            data.game.fen.trim() !== expectedFenRef.current.trim()
          ) {
            console.log("Ignoring stale game snapshot (fen)");
            return;
          }

          console.log("Setting game state:", newGameState);
          setGameState(newGameState);
          // No clocks: just clear local gameOver state on fresh active games
          const isActive = data.game.status === "active";
          if (isActive) setGameOver(null);
          setError(null);
        } else {
          // Check if this is an authentication error
          if (response.status === 401) {
            console.log("Authentication required, redirecting to sign-in");
            window.location.href = `/auth/signin?redirectTo=/board${window.location.search}`;
            return;
          }
          
          console.warn(
            "Server load failed; keeping current view and will retry:",
            data.error,
          );
          setError(
            "Unable to sync with server. You can continue playing; moves will sync when connection is back.",
          );
          return;
        }
      } catch (err) {
        console.error(`Error loading game data for ${id}:`, err);
        setError(
          "Offline — showing last known position. Moves will sync when back online.",
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
      console.log("Creating new game...");
      const response = await fetch("/api/games", {
        method: "POST",
      });
      
      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response');
      }
      
      const data = await response.json();
      console.log(data, "Data");

      console.log("New game response:", response.status, data);

      if (response.ok) {
        // Update URL with new game ID
        window.history.replaceState({}, "", `/board?id=${data.gameId}`);
        // Set override so child components and sync use new id immediately without reload
        try {
          setOverrideGameId(data.gameId);
        } catch {}
        // Load the game data inline to avoid dependency issues
        try {
          console.log(`Loading game data for ${data.gameId}...`);
          const gameResponse = await fetch(`/api/games/${data.gameId}`);
          
          // Check if response is JSON before parsing
          const gameContentType = gameResponse.headers.get('content-type');
          if (!gameContentType || !gameContentType.includes('application/json')) {
            throw new Error('Game data response is not JSON');
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
              moveHistory,
              capturedPieces,
            };

            setGameState(newGameState);
            setGameOver(null);
            setError(null);
          } else {
            console.warn(
              "Failed to load newly created game, switching to local:",
              gameData.error,
            );
            startLocalGame();
          }
        } catch (err) {
          console.error(`Error loading game data for ${data.gameId}:`, err);
          startLocalGame();
        } finally {
          setLoading(false);
        }
      } else {
        console.warn("Create game failed, switching to local:", data.error);
        startLocalGame();
        setLoading(false);
      }
    } catch (err) {
      console.error("Error creating game:", err);
      // Fallback to local game
      startLocalGame();
    }
  }, [startLocalGame]);

  const loadGame = useCallback(
    async (id: number) => {
      // Validate that id is a valid number
      if (!id || isNaN(id) || !Number.isInteger(id) || id <= 0) {
        console.warn(`Invalid game ID: ${id}, creating new game`);
        createNewGame();
        return;
      }

      try {
        setLoading(true);
        console.log(`Loading game ${id}...`);
        const response = await fetch(`/api/games/${id}`);
        
        // Check if response is JSON before parsing
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Server returned non-JSON response');
        }
        
        const data = await response.json();

        console.log(`Game ${id} response:`, response.status, data);

        if (response.ok) {
          // Parse move history to extract captured pieces and move notations
          const moveHistory = data.game.moves.map(
            (move: { move_notation: string }) => move.move_notation,
          );
          const capturedPieces = extractCapturedPieces(data.game.moves);

          const newGameState = {
            fen: data.game.fen,
            currentTurn: data.game.current_player,
            gameStatus: data.game.status,
            moveHistory,
            capturedPieces,
          };

          console.log("Setting game state:", newGameState);
          setGameState(newGameState);
          if (data.game.status === "active") setGameOver(null);
          setError(null);
        } else {
          // Check if this is an authentication error
          if (response.status === 401) {
            console.log("Authentication required, redirecting to sign-in");
            window.location.href = `/auth/signin?redirectTo=/board${window.location.search}`;
            return;
          }
          
          // Server failed or game not found -> fallback to local
          console.warn(
            `Game ${id} not found or server failed; staying on current view`,
          );
          setError("Unable to load latest state. Retrying…");
        }
      } catch (err) {
        console.warn(`Error loading game ${id}; staying on current view:`, err);
        setError(
          "Offline — showing last known position. Moves will sync when back online.",
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
        console.warn(`Invalid game ID in URL: ${gameId}, creating new game`);
        createNewGame();
      }
    } else {
      // No game ID provided, create a new game
      createNewGame();
    }
  }, [gameId, createNewGame, loadGame]);

  // Timers removed: no clock storage/hydration

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

  // Board orientation: side to move always at bottom unless remote mode locks user color
  const boardOrientation: "white" | "black" =
    mode === "remote" && youColorParam ? youColorParam : fenTurn;

  // Timers removed: no ticking, storage, or timeout logic

  const handleMove = async (result: {
    success: boolean;
    fen: string;
    gameStatus?: string;
    move?: string;
    from?: string;
    to?: string;
    promotion?: string;
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

      setGameState((prev) => ({
        fen: result.fen,
        currentTurn: appliedTurn,
        gameStatus: result.gameStatus || "active",
        moveHistory: [
          ...prev.moveHistory,
          ...(result.move ? [result.move] : []),
        ],
        capturedPieces: prev.capturedPieces, // Would update based on captures
      }));

      // Vs Computer removed

      // If game ended, persist status/winner to DB
      if (isEnd) {
        const winner =
          result.gameStatus === "checkmate"
            ? boardOrientation // mover won
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
        // Persist end state to DB if available
        if (effectiveGameId) {
          const status = result.gameStatus as string;
          const winnerForDb =
            status === "checkmate"
              ? boardOrientation
              : status === "draw" || status === "stalemate"
                ? "draw"
                : null;
          fetch(`/api/games/${effectiveGameId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status,
              winner: winnerForDb,
            }),
          }).catch(() => {});
        }
      }

      // Reload game data to ensure sync without resetting clocks
      if (isOnline && effectiveGameId && !isEnd) {
        // Best-effort resync soon, but ignore stale responses that don't reflect our move yet
        setTimeout(
          () => loadGameData(effectiveGameId, { resetClocks: false }),
          150,
        );
      }
    }
  };

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
      console.warn("Server reset failed, staying in local mode.");
    }
  };

  // Memes and YouTube UI removed
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [queuedCount, setQueuedCount] = useState<number>(0);
  const [conflict, setConflict] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<null | {
    type: "info" | "warn" | "error";
    message: string;
  }>(null);
  const [syncing, setSyncing] = useState<boolean>(false);
  const flushQueuedMovesRef = useRef<() => void>(() => {});
  const flushOfflineQueueRef = useRef<() => void>(() => {});

  // Track online/offline and queued move count
  useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    const onQueue = (e: Event) => {
      const det = (e as CustomEvent).detail as
        | { gameId?: string | number; length?: number }
        | undefined;
      if (det && typeof det.length === "number") setQueuedCount(det.length);
    };
    window.addEventListener("chess-queue-updated", onQueue as EventListener);
    // Try flush when tab becomes visible again (useful after reconnection)
    const onVis = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        // debounce a bit
        setTimeout(() => {
          if (flushOfflineQueueRef.current) flushOfflineQueueRef.current();
          if (flushQueuedMovesRef.current) flushQueuedMovesRef.current();
        }, 150);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    // Initialize queuedCount on mount
    try {
      if (effectiveGameId) {
        const key = `queuedMoves:${effectiveGameId}`;
        const raw = localStorage.getItem(key);
        setQueuedCount(raw ? JSON.parse(raw).length : 0);
      }
    } catch {}
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
      window.removeEventListener(
        "chess-queue-updated",
        onQueue as EventListener,
      );
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [effectiveGameId]);

  // Flush queued moves for an existing server game when coming online
  const flushQueuedMoves = useCallback(async () => {
    if (!effectiveGameId) return;
    const id = effectiveGameId;
    const key = `queuedMoves:${effectiveGameId}`;
    setSyncing(true);
    setSyncStatus({ type: "info", message: "Syncing queued moves..." });
    try {
      const raw = localStorage.getItem(key);
      type QueuedMove = {
        from: string;
        to: string;
        promotion: string | null;
        ts: number;
        clientMoveId?: string;
        expectedPly?: number;
        prevFen?: string;
        san?: string;
      };
      let queue: QueuedMove[] = raw ? (JSON.parse(raw) as QueuedMove[]) : [];
      if (!queue.length) {
        setSyncStatus(null);
        return;
      }

      // Process sequentially; stop on any hard error to retry later
      while (queue.length > 0) {
        const m = queue[0];
        const res = await fetch(`/api/games/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            from: m.from,
            to: m.to,
            promotion: m.promotion ?? undefined,
            clientMoveId: m.clientMoveId,
            expectedPly: m.expectedPly,
            prevFen: m.prevFen,
            san: m.san,
          }),
        });

        if (!res.ok) {
          let errMsg: string | null = null;
          try {
            const body = await res.json();
            errMsg = (body && (body.error as string)) || null;
          } catch {
            try {
              const text = await res.text();
              errMsg = text || null;
            } catch {
              errMsg = null;
            }
          }

          if (res.status === 401) {
            setSyncStatus({
              type: "error",
              message: "Unauthorized. Please sign in to sync your moves.",
            });
            break; // keep queue intact for later
          }

          if (errMsg && /conflict|order|stale/i.test(errMsg)) {
            setConflict(errMsg);
            setSyncStatus({
              type: "warn",
              message: "Move order conflict. Reload and try again.",
            });
            break; // keep queue intact
          }

          setSyncStatus({
            type: "error",
            message: `Sync failed: ${errMsg || `HTTP ${res.status}`}`,
          });
          break; // keep queue intact
        }

        // Success: remove the head and continue
        queue = queue.slice(1);
        localStorage.setItem(key, JSON.stringify(queue));
        setQueuedCount(queue.length);
      }

      if (queue.length === 0) {
        setSyncStatus({ type: "info", message: "All moves synced." });
        await loadGameData(id, { resetClocks: false });
        setConflict(null);
      }
    } catch {
      setSyncStatus({ type: "error", message: "Sync failed. Will retry." });
    } finally {
      setSyncing(false);
    }
  }, [effectiveGameId, loadGameData]);

  // Flush offline queued moves by ensuring a server game exists and replaying moves
  const flushOfflineQueueIfAny = useCallback(async () => {
    const offlineKey = "queuedMoves:offline";
    try {
      const raw = localStorage.getItem(offlineKey);
      type OfflineMove = {
        from: string;
        to: string;
        promotion: string | null;
        ts: number;
        san?: string;
      };
      let queue: OfflineMove[] = raw ? (JSON.parse(raw) as OfflineMove[]) : [];
      if (!queue.length) return;

      // Determine or create a game id to sync into
      let idToUse: number | null = null;
      if (effectiveGameId && Number.isInteger(effectiveGameId)) {
        idToUse = effectiveGameId;
      } else {
        // Create a new game on server
        const resp = await fetch("/api/games", { method: "POST" });
        const data = await resp.json().catch(() => null);
        if (!resp.ok || !data || typeof data.gameId !== "number") {
          setSyncStatus({
            type: "error",
            message: "Could not create game for sync.",
          });
          return;
        }
        idToUse = data.gameId;
        setOverrideGameId(idToUse);
        try {
          window.history.replaceState({}, "", `/board?id=${idToUse}`);
        } catch {}
      }

      if (!idToUse) return;

      // Replay offline moves sequentially
      setSyncing(true);
      setSyncStatus({ type: "info", message: "Syncing offline moves..." });
      while (queue.length > 0) {
        const m = queue[0];
        const res = await fetch(`/api/games/${idToUse}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            from: m.from,
            to: m.to,
            promotion: m.promotion ?? undefined,
            san: m.san,
          }),
        });
        if (!res.ok) {
          // Stop and keep queue for later
          let msg: string | null = null;
          try {
            const b = await res.json();
            msg = b?.error || null;
          } catch {}
          if (res.status === 401) {
            setSyncStatus({
              type: "error",
              message: "Unauthorized. Please sign in to sync.",
            });
          } else if (msg && /conflict|order|stale/i.test(msg)) {
            setConflict(msg);
            setSyncStatus({
              type: "warn",
              message: "Move order conflict. Reload and try again.",
            });
          } else {
            setSyncStatus({
              type: "error",
              message: `Sync failed: ${msg || `HTTP ${res.status}`}`,
            });
          }
          break;
        }
        // Success: drop the head
        queue = queue.slice(1);
        localStorage.setItem(offlineKey, JSON.stringify(queue));
      }

      if (queue.length === 0) {
        setSyncStatus({ type: "info", message: "All offline moves synced." });
        await loadGameData(idToUse, { resetClocks: false });
        setConflict(null);
      }
    } catch {
      setSyncStatus({
        type: "error",
        message: "Offline sync failed. Will retry.",
      });
    } finally {
      setSyncing(false);
    }
  }, [effectiveGameId, loadGameData]);

  // Keep ref pointing to latest callback for earlier effects
  useEffect(() => {
    flushQueuedMovesRef.current = () => {
      void flushQueuedMoves();
    };
  }, [flushQueuedMoves]);

  useEffect(() => {
    flushOfflineQueueRef.current = () => {
      void flushOfflineQueueIfAny();
    };
  }, [flushOfflineQueueIfAny]);

  useEffect(() => {
    if (isOnline) {
      // First try to sync any offline moves (no server game yet), then game-specific queued moves
      flushOfflineQueueIfAny().finally(() => {
        flushQueuedMoves();
      });
    }
  }, [isOnline, flushQueuedMoves, flushOfflineQueueIfAny]);

  if (loading) {
    return <LoadingSpinner />;
  }

  // Do not block the board on non-fatal errors; show inline banners instead

  return (
    <>
      <div className="min-h-screen text-white flex flex-col pb-12 overflow-x-hidden" style={{ backgroundColor: '#141414' }}>
      <div className="container mx-auto px-4 py-4 flex-0">
        {/* Online/Offline + Queue status */}
        <div className="mb-2 flex items-center gap-3 text-sm text-gray-300 hidden">
          {!isOnline && (
            <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-yellow-500/30 bg-yellow-500/10 text-yellow-300">
              <span className="w-2 h-2 rounded-full bg-yellow-400" /> Offline —
              moves will sync when back
            </span>
          )}
          {queuedCount > 0 && (
            <button
              onClick={flushQueuedMoves}
              className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-accent/30 bg-accent-ghost text-accent disabled:opacity-60"
              disabled={syncing}
            >
              <span className="w-2 h-2 rounded-full bg-violet-400" />
              {syncing ? "Syncing…" : `Sync pending: ${queuedCount}`}
            </button>
          )}
          {conflict && (
            <button
              onClick={() => {
                setConflict(null);
                if (effectiveGameId)
                  loadGameData(effectiveGameId, { resetClocks: false });
              }}
              className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-300"
            >
              <span className="w-2 h-2 rounded-full bg-orange-400" /> Conflict
              detected — Reload
            </button>
          )}
          {syncStatus && (
            <span
              className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border ${
                syncStatus.type === "info"
                  ? "border-accent/30 bg-accent-ghost text-accent"
                  : syncStatus.type === "warn"
                    ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
                    : "border-red-500/30 bg-red-500/10 text-red-300"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-current" />
              {syncStatus.message}
            </span>
          )}
          {error && (
            <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-red-300">
              <span className="w-2 h-2 rounded-full bg-red-400" /> {error}
            </span>
          )}
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 overflow-hidden">
        {/* Chess Board centered with tiles connected to board edges */}
        <div className="flex justify-center flex-1 min-w-0">
          <div className="flex flex-col items-stretch gap-2 w-full h-full">
            {/* Vs Computer UI removed */}

            <ChessBoard
              gameId={effectiveGameId ?? undefined}
              fen={gameState.fen}
              onMove={handleMove}
              disabled={gameState.gameStatus !== "active" || Boolean(gameOver)}
              orientation={boardOrientation}
              turn={fenTurn}
            />
            {gameOver && (
              <div className="text-accent mt-3 text-center">
                {gameOver.reason}
              </div>
            )}
          </div>
        </div>
        {/* Right-side memes section removed */}
      </div>
      </div>
      
      {/* Slide-out navigator - always mounted but controlled by state */}
      <GameNavigator
        open={navigatorOpen}
        onOpenChange={setNavigatorOpen}
        showButton={!isBoardHovered}
        onNewGame={(choice) => {
          if (choice === "local-2v2") {
            resetGame();
          }
        }}
      />
    </>
  );
}

export default function Board() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <BoardContent />
    </Suspense>
  );
}

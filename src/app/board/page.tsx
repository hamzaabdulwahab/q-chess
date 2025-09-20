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
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ThemeProvider } from "@/lib/theme-context";
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

  // State for access denial dialog
  const [showAccessDialog, setShowAccessDialog] = useState(false);

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

    // REMOVED: Offline queue hydration - games will be disabled when offline instead
    // No more complex queue system - ensures database consistency
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

          // Trigger sync after successful game load to ensure any pending moves are synced
          // REMOVED: No more queue system - games will be disabled when offline instead
          // setTimeout(() => {
          //   if (id && Number.isInteger(id)) {
          //     console.log("Triggering post-load sync for game", id);
          //     flushQueuedMovesRef.current?.();
          //   }
          // }, 500);
        } else {
          // Check if this is an authentication error
          if (response.status === 401) {
            console.log("Authentication required, redirecting to sign-in");
            window.location.href = `/auth/signin?redirectTo=/board${window.location.search}`;
            return;
          }
          
          // Check if game not found - show professional error instead of alert
          if (response.status === 404) {
            console.log("Game not found, showing user-friendly message");
            
            // Professional UX: Show custom dialog instead of browser confirm
            setShowAccessDialog(true);
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
          "Game disabled while offline — connect to internet to play.",
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

  // Dialog handlers for access denial
  const handleCreateNewGame = useCallback(async () => {
    setShowAccessDialog(false);
    await createNewGame();
  }, [createNewGame]);

  const handleReturnHome = useCallback(() => {
    setShowAccessDialog(false);
    window.location.href = '/';
  }, []);

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
          
          // Check if game not found - show professional error instead of alert
          if (response.status === 404) {
            console.log("Game not found, showing user-friendly message");
            
            // Professional UX: Show custom dialog instead of browser confirm
            setShowAccessDialog(true);
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
          "Game disabled while offline — connect to internet to play.",
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
        // Determine winner consistent with chess-service logic:
        // After the move, result.fen / internal chess state has turn set to the side that would move next.
        // In checkmate, that side is the loser; winner is the opposite.
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
        if (effectiveGameId) {
          const status = result.gameStatus as string;
          const winnerForDb =
            status === "checkmate"
              ? winner
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
  
  // Removed offline queue system - game will be disabled when offline instead
  // const [queuedCount, setQueuedCount] = useState<number>(0);
  // const [conflict, setConflict] = useState<string | null>(null);
  // const [syncStatus, setSyncStatus] = useState<null | {
  //   type: "info" | "warn" | "error";
  //   message: string;
  // }>(null);
  // const [syncing, setSyncing] = useState<boolean>(false);
  // const flushQueuedMovesRef = useRef<() => void>(() => {});
  // const flushOfflineQueueRef = useRef<() => void>(() => {});

  // Track online/offline status for clean game disabling
  useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  // REMOVED: Complex offline queue system replaced with simple offline game disabling
  // The game will now be disabled when offline to ensure database consistency
  // No more complex queue management, sync logic, or partial state management

  // Memoize the navigator open change callback to prevent unnecessary re-renders
  const handleNavigatorOpenChange = useCallback((open: boolean) => {
    setNavigatorOpen(open);
  }, []);

  if (loading) {
    return <LoadingSpinner />;
  }

  // Do not block the board on non-fatal errors; show inline banners instead

  return (
    <>
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
                  style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                >
                  Game Disabled - No Internet
                </h3>
              </div>

              {/* Content */}
              <div className="px-6 pb-6">
                <p 
                  id="offline-message"
                  className="text-gray-300 leading-relaxed"
                  style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                >
                  The game is temporarily disabled while offline to ensure your moves are properly saved.
                </p>
                
                <ul className="mt-4 space-y-2">
                  <li 
                    className="text-sm text-gray-400 flex items-start"
                    style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                  >
                    <span className="mr-2 text-gray-500">•</span>
                    Connect to the internet to resume playing
                  </li>
                  <li 
                    className="text-sm text-gray-400 flex items-start"
                    style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
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
      <div className="flex-1 flex items-center justify-center px-4 overflow-hidden">
        {/* Chess Board centered with tiles connected to board edges */}
        <div className="flex justify-center flex-1 min-w-0">
          <div className="flex flex-col items-stretch gap-2 w-full h-full">
            {/* Vs Computer UI removed */}

            <ChessBoard
              gameId={effectiveGameId ?? undefined}
              fen={gameState.fen}
              onMove={handleMove}
              disabled={gameState.gameStatus !== "active" || Boolean(gameOver) || !isOnline}
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
        onOpenChange={handleNavigatorOpenChange}
        showButton={!isBoardHovered}
        onNewGame={(choice) => {
          if (choice === "local-2v2") {
            resetGame();
          }
        }}
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
    </>
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

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
import Link from "next/link";
import { GameNavigator } from "@/components/GameNavigator";
import { PlayerBadge } from "@/components/PlayerBadge";
import type { NewGameChoice } from "@/components/NewGameModal";
import { useRouter } from "next/navigation";

const extractCapturedPieces = (
  moves: Array<{ move_notation: string; player: string }>
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
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameState, setGameState] = useState({
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    currentTurn: "white" as "white" | "black",
    gameStatus: "active",
    moveHistory: [] as string[],
    capturedPieces: { white: [] as string[], black: [] as string[] },
  });
  // 25 minutes per player
  const INITIAL_MS = 25 * 60 * 1000;
  const [whiteTimeMs, setWhiteTimeMs] = useState<number>(INITIAL_MS);
  const [blackTimeMs, setBlackTimeMs] = useState<number>(INITIAL_MS);
  const [gameOver, setGameOver] = useState<null | {
    winner: "white" | "black";
    reason: string;
  }>(null);
  const [started, setStarted] = useState<boolean>(false);
  const hydratedRef = useRef(false);
  // After an optimistic move, we expect the next turn; use this to ignore stale server snapshots
  const expectedTurnRef = useRef<"white" | "black" | null>(null);
  const expectedFenRef = useRef<string | null>(null);
  const clearExpectedTimerRef = useRef<number | null>(null);
  // Board always auto-rotates by current turn

  const loadGameData = useCallback(
    async (
      id: number,
      opts?: {
        resetClocks?: boolean; // default true for initial loads
      }
    ) => {
      try {
        console.log(`Loading game data for ${id}...`);
        const response = await fetch(`/api/games/${id}`);
        const data = await response.json();

        console.log(`Game ${id} data response:`, response.status, data);

        if (response.ok) {
          // Parse move history to extract captured pieces and move notations
          const moveHistory = data.game.moves.map(
            (move: { move_notation: string }) => move.move_notation
          );
          const capturedPieces = extractCapturedPieces(data.game.moves);

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
              expectedTurnRef.current
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
          // By default reset clocks only on initial loads; avoid resets on turn flips
          const doReset = opts?.resetClocks ?? true;
          if (doReset) {
            setWhiteTimeMs(INITIAL_MS);
            setBlackTimeMs(INITIAL_MS);
            setGameOver(null);
            setStarted(moveHistory.length > 0);
          } else {
            // Preserve existing clocks; just ensure started is true once moves exist
            setStarted((prev) => prev || moveHistory.length > 0);
          }
          setError(null);
        } else {
          throw new Error(`Failed to load game: ${data.error}`);
        }
      } catch (err) {
        console.error(`Error loading game data for ${id}:`, err);
        setError(`Failed to load game ${id}`);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const createNewGame = useCallback(async () => {
    try {
      setLoading(true);
      console.log("Creating new game...");
      const response = await fetch("/api/games", {
        method: "POST",
      });
      const data = await response.json();
      console.log(data, "Data");

      console.log("New game response:", response.status, data);

      if (response.ok) {
        // Update URL with new game ID
        window.history.replaceState({}, "", `/board?id=${data.gameId}`);
        // Load the game data inline to avoid dependency issues
        try {
          console.log(`Loading game data for ${data.gameId}...`);
          const gameResponse = await fetch(`/api/games/${data.gameId}`);
          const gameData = await gameResponse.json();

          if (gameResponse.ok) {
            const moveHistory = gameData.game.moves.map(
              (move: { move_notation: string }) => move.move_notation
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
            setWhiteTimeMs(INITIAL_MS);
            setBlackTimeMs(INITIAL_MS);
            setGameOver(null);
            setStarted(false);
            setError(null);
          } else {
            throw new Error(`Failed to load game: ${gameData.error}`);
          }
        } catch (err) {
          console.error(`Error loading game data for ${data.gameId}:`, err);
          setError(`Failed to load game ${data.gameId}`);
        } finally {
          setLoading(false);
        }
      } else {
        setError(data.error || "Failed to create game");
        setLoading(false);
      }
    } catch (err) {
      setError("Failed to create game");
      setLoading(false);
      console.error("Error creating game:", err);
    }
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
        const data = await response.json();

        console.log(`Game ${id} response:`, response.status, data);

        if (response.ok) {
          // Parse move history to extract captured pieces and move notations
          const moveHistory = data.game.moves.map(
            (move: { move_notation: string }) => move.move_notation
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
          setWhiteTimeMs(INITIAL_MS);
          setBlackTimeMs(INITIAL_MS);
          setGameOver(null);
          setStarted(moveHistory.length > 0);
          setError(null);
          setLoading(false);
        } else {
          // Game not found, create a new one instead
          console.warn(`Game ${id} not found, creating new game`);
          createNewGame();
        }
      } catch (err) {
        console.warn(`Error loading game ${id}, creating new game:`, err);
        createNewGame();
      }
    },
    [createNewGame]
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

  // Persist clocks to localStorage and hydrate on mount/changes
  const storageKey = React.useMemo(
    () => `board-clock-${gameId ?? "new"}`,
    [gameId]
  );

  // Hydrate clocks once when loading completes and we have a game state
  useEffect(() => {
    if (loading || hydratedRef.current) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        white: number;
        black: number;
        started: boolean;
        currentTurn: "white" | "black";
        savedAt: number;
      };
      let w = saved.white;
      let b = saved.black;
      if (saved.started && gameState.gameStatus === "active") {
        const elapsed = Date.now() - (saved.savedAt || Date.now());
        if (elapsed > 0) {
          if (saved.currentTurn === gameState.currentTurn) {
            if (saved.currentTurn === "white") w = Math.max(0, w - elapsed);
            else b = Math.max(0, b - elapsed);
          }
        }
      }
      setWhiteTimeMs(w);
      setBlackTimeMs(b);
      setStarted((prev) => prev || saved.started);
      hydratedRef.current = true;
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, storageKey, gameState.currentTurn, gameState.gameStatus]);

  // Save clocks on changes
  useEffect(() => {
    try {
      const payload = {
        white: whiteTimeMs,
        black: blackTimeMs,
        started,
        currentTurn: gameState.currentTurn,
        savedAt: Date.now(),
      };
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {}
  }, [whiteTimeMs, blackTimeMs, started, gameState.currentTurn, storageKey]);

  // Clock ticking for local board
  useEffect(() => {
    if (gameState.gameStatus !== "active" || gameOver || !started) return;
    let raf: number;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      if (gameState.currentTurn === "white") {
        setWhiteTimeMs((t) => Math.max(0, t - dt));
      } else {
        setBlackTimeMs((t) => Math.max(0, t - dt));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [gameState.currentTurn, gameState.gameStatus, gameOver]);

  // Timeout -> end local game and persist winner/status
  useEffect(() => {
    if (!gameOver && whiteTimeMs <= 0 && gameState.gameStatus === "active") {
      setGameOver({ winner: "black", reason: "White ran out of time" });
      setGameState((prev) => ({ ...prev, gameStatus: "timeout" }));
      if (gameId) {
        // best-effort update; ignore failures
        fetch(`/api/games/${gameId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "timeout", winner: "black" }),
        }).catch(() => {});
      }
    }
  }, [whiteTimeMs, gameOver, gameId, gameState.gameStatus]);

  useEffect(() => {
    if (!gameOver && blackTimeMs <= 0 && gameState.gameStatus === "active") {
      setGameOver({ winner: "white", reason: "Black ran out of time" });
      setGameState((prev) => ({ ...prev, gameStatus: "timeout" }));
      if (gameId) {
        fetch(`/api/games/${gameId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "timeout", winner: "white" }),
        }).catch(() => {});
      }
    }
  }, [blackTimeMs, gameOver, gameId, gameState.gameStatus]);

  const handleMove = (result: {
    success: boolean;
    fen: string;
    gameStatus?: string;
    move?: string;
    from?: string;
    to?: string;
    promotion?: string;
  }) => {
    if (result.success && !gameOver) {
      if (!started) setStarted(true);
      const nextTurn = gameState.currentTurn === "white" ? "black" : "white";
      // Track expected server state to avoid accepting stale snapshots
      expectedTurnRef.current = nextTurn;
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
        currentTurn: nextTurn,
        gameStatus: result.gameStatus || "active",
        moveHistory: [
          ...prev.moveHistory,
          ...(result.move ? [result.move] : []),
        ],
        capturedPieces: prev.capturedPieces, // Would update based on captures
      }));

      // If game ended, stop clocks immediately
      if (result.gameStatus && result.gameStatus !== "active") {
        setGameOver({
          winner:
            result.gameStatus === "checkmate"
              ? gameState.currentTurn === "white"
                ? "black"
                : "white"
              : "white", // placeholder for draw/stalemate; UI already shows overlay
          reason:
            result.gameStatus === "checkmate"
              ? "Checkmate"
              : result.gameStatus === "stalemate"
              ? "Stalemate"
              : "Draw",
        });
      }

      // Reload game data to ensure sync without resetting clocks
      if (gameId) {
        // Best-effort resync soon, but ignore stale responses that don't reflect our move yet
        setTimeout(
          () => loadGameData(parseInt(gameId), { resetClocks: false }),
          150
        );
      }
    }
  };

  const resetGame = async (choice?: NewGameChoice) => {
    // If user chose online, send them to /online which will handle room join/share
    if (choice === "online") {
      router.push("/online");
      return;
    }
    // Local 2v2 or default -> create a fresh DB-backed game like before
    if (gameId) {
      try {
        // Delete current game and create new one
        await fetch(`/api/games?id=${gameId}`, { method: "DELETE" });
        createNewGame();
      } catch (err) {
        console.error("Error resetting game:", err);
        setError("Failed to reset game");
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading game...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">{error}</div>
          <Link
            href="/"
            className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white px-6 py-3 rounded-lg transition-colors font-medium"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="container mx-auto px-4 py-4 flex-0">
        {/* Slide-out navigator */}
        <GameNavigator onNewGame={resetGame} />
      </div>
      <div className="flex-1 flex items-center justify-center px-4">
        {/* Chess Board centered with tiles connected to board edges */}
        <div className="flex justify-center">
          <div
            className="flex flex-col items-stretch gap-2"
            style={{ width: 864 }}
          >
            <div className="flex justify-start">
              <PlayerBadge
                name={gameState.currentTurn === "white" ? "Black" : "White"}
                username={gameState.currentTurn === "white" ? "black" : "white"}
                timeMs={
                  gameState.currentTurn === "white" ? blackTimeMs : whiteTimeMs
                }
                active={false}
                align="top-left"
                color={gameState.currentTurn === "white" ? "black" : "white"}
                absolute={false}
              />
            </div>
            <ChessBoard
              gameId={gameId ? parseInt(gameId) : undefined}
              fen={gameState.fen}
              onMove={handleMove}
              disabled={gameState.gameStatus !== "active" || Boolean(gameOver)}
              orientation={gameState.currentTurn}
              turn={gameState.currentTurn}
            />
            <div className="flex justify-end">
              <PlayerBadge
                name={gameState.currentTurn === "white" ? "White" : "Black"}
                username={gameState.currentTurn === "white" ? "white" : "black"}
                timeMs={
                  gameState.currentTurn === "white" ? whiteTimeMs : blackTimeMs
                }
                active={true}
                align="bottom-right"
                color={gameState.currentTurn === "white" ? "white" : "black"}
                absolute={false}
              />
            </div>
            {gameOver && (
              <div className="text-accent mt-3 text-center">
                {gameOver.reason}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Board() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="text-white text-xl">Loading...</div>
        </div>
      }
    >
      <BoardContent />
    </Suspense>
  );
}

"use client";

import React, { useState, useEffect, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { ChessBoard } from "@/components/ChessBoard";
import Link from "next/link";

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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameState, setGameState] = useState({
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    currentTurn: "white" as "white" | "black",
    gameStatus: "active",
    moveHistory: [] as string[],
    capturedPieces: { white: [] as string[], black: [] as string[] },
  });

  const loadGameData = useCallback(async (id: number) => {
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

        console.log("Setting game state:", newGameState);
        setGameState(newGameState);
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
  }, []);

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

  const handleMove = (result: {
    success: boolean;
    fen: string;
    gameStatus?: string;
    move?: string;
  }) => {
    if (result.success) {
      setGameState((prev) => ({
        fen: result.fen,
        currentTurn: prev.currentTurn === "white" ? "black" : "white",
        gameStatus: result.gameStatus || "active",
        moveHistory: [
          ...prev.moveHistory,
          ...(result.move ? [result.move] : []),
        ],
        capturedPieces: prev.capturedPieces, // Would update based on captures
      }));

      // Reload game data to ensure sync
      if (gameId) {
        setTimeout(() => loadGameData(parseInt(gameId)), 100);
      }
    }
  };

  const resetGame = async () => {
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
            className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white px-6 py-3 rounded-lg transition-colors font-medium"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Simple Header with Turn Indicator */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <p className="text-xl font-medium text-gray-300">
              {gameState.gameStatus === "active"
                ? `${gameState.currentTurn}'s turn`
                : gameState.gameStatus === "checkmate"
                ? "🏆 Checkmate!"
                : gameState.gameStatus === "stalemate"
                ? "🤝 Stalemate - Draw"
                : gameState.gameStatus === "draw"
                ? "🤝 Draw"
                : `Game ${gameState.gameStatus}`}
            </p>
          </div>

          <div className="flex space-x-4">
            <button
              onClick={resetGame}
              className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
            >
              New Game
            </button>
            <Link
              href="/"
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
            >
              Home
            </Link>
          </div>
        </div>

        {/* Chess Board - Centered */}
        <div className="flex justify-center">
          <ChessBoard
            gameId={gameId ? parseInt(gameId) : undefined}
            fen={gameState.fen}
            onMove={handleMove}
            disabled={gameState.gameStatus !== "active"}
          />
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

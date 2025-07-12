"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ChessBoard } from "@/components/ChessBoard";
import { GameStatus } from "@/types/chess";
import Link from "next/link";

function BoardContent() {
  const searchParams = useSearchParams();
  const gameId = searchParams.get("id");

  const [gameState, setGameState] = useState({
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    currentTurn: "white" as "white" | "black",
    gameStatus: "active",
    moveHistory: [] as string[],
    capturedPieces: { white: [] as string[], black: [] as string[] },
  });

  const [gameStatusInfo, setGameStatusInfo] = useState<GameStatus>({
    isCheckmate: false,
    isStalemate: false,
    isDraw: false,
    isInCheck: false,
    turn: "white",
  });

  const handleMove = (result: {
    success: boolean;
    fen: string;
    gameStatus?: string;
    move?: string;
  }) => {
    if (result.success) {
      setGameState((prev) => ({
        ...prev,
        fen: result.fen,
        currentTurn: prev.currentTurn === "white" ? "black" : "white",
        moveHistory: result.move
          ? [...prev.moveHistory, result.move]
          : prev.moveHistory,
      }));
    }
  };

  const handleGameStatusChange = (status: GameStatus) => {
    setGameStatusInfo(status);
  };

  const resetGame = () => {
    setGameState({
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      currentTurn: "white",
      gameStatus: "active",
      moveHistory: [],
      capturedPieces: { white: [], black: [] },
    });
    setGameStatusInfo({
      isCheckmate: false,
      isStalemate: false,
      isDraw: false,
      isInCheck: false,
      turn: "white",
    });
  };

  const getGameStatusMessage = () => {
    if (gameStatusInfo.isCheckmate) {
      return `Checkmate! ${
        gameStatusInfo.turn === "white" ? "Black" : "White"
      } wins!`;
    }
    if (gameStatusInfo.isStalemate) {
      return "Stalemate! Game is a draw.";
    }
    if (gameStatusInfo.isDraw) {
      return "Draw! Game ended in a draw.";
    }
    if (gameStatusInfo.isInCheck) {
      return `${
        gameStatusInfo.turn === "white" ? "White" : "Black"
      } is in check!`;
    }
    return `${gameStatusInfo.turn === "white" ? "White" : "Black"} to move`;
  };

  const getStatusColor = () => {
    if (gameStatusInfo.isCheckmate) return "text-red-600";
    if (gameStatusInfo.isStalemate || gameStatusInfo.isDraw)
      return "text-yellow-600";
    if (gameStatusInfo.isInCheck) return "text-orange-600";
    return "text-gray-700";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            ♛ Chess Game ♛
          </h1>
          <p className="text-gray-600">
            {gameId ? `Game ID: ${gameId}` : "New Game"}
          </p>
        </div>

        {/* Game Status */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className={`text-xl font-semibold ${getStatusColor()}`}>
                {getGameStatusMessage()}
              </h2>
              <p className="text-sm text-gray-600">
                Move #{Math.ceil(gameState.moveHistory.length / 2) + 1}
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={resetGame}
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
              >
                🔄 Reset Game
              </button>
              <Link
                href="/"
                className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
              >
                🏠 Home
              </Link>
            </div>
          </div>
        </div>

        {/* Game Board and Info */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Chess Board */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <ChessBoard
                gameId={gameId ? parseInt(gameId) : undefined}
                fen={gameState.fen}
                onMove={handleMove}
                onGameStatusChange={handleGameStatusChange}
              />
            </div>
          </div>

          {/* Game Info Panel */}
          <div className="lg:col-span-1 space-y-4">
            {/* Turn Indicator */}
            <div className="bg-white rounded-lg shadow-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Current Turn
              </h3>
              <div className="flex items-center space-x-2">
                <div
                  className={`w-4 h-4 rounded-full ${
                    gameStatusInfo.turn === "white"
                      ? "bg-gray-200 border-2 border-gray-400"
                      : "bg-gray-800"
                  }`}
                ></div>
                <span className="capitalize font-medium">
                  {gameStatusInfo.turn}
                </span>
              </div>
            </div>

            {/* Move History */}
            <div className="bg-white rounded-lg shadow-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Move History
              </h3>
              <div className="max-h-40 overflow-y-auto">
                {gameState.moveHistory.length === 0 ? (
                  <p className="text-gray-500 text-sm">No moves yet</p>
                ) : (
                  <div className="space-y-1">
                    {gameState.moveHistory.map((move, index) => (
                      <div key={index} className="text-sm">
                        <span className="text-gray-600">
                          {Math.ceil((index + 1) / 2)}.
                        </span>
                        {index % 2 === 0 && (
                          <span className="ml-1 font-mono">{move}</span>
                        )}
                        {index % 2 === 1 && (
                          <span className="ml-4 font-mono">{move}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Game Info */}
            <div className="bg-white rounded-lg shadow-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Game Info
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className={`font-medium ${getStatusColor()}`}>
                    {gameStatusInfo.isCheckmate
                      ? "Checkmate"
                      : gameStatusInfo.isStalemate
                      ? "Stalemate"
                      : gameStatusInfo.isDraw
                      ? "Draw"
                      : gameStatusInfo.isInCheck
                      ? "Check"
                      : "Active"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Moves:</span>
                  <span className="font-medium">
                    {gameState.moveHistory.length}
                  </span>
                </div>
              </div>
            </div>
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
        <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
          <div className="text-gray-700 text-xl">Loading game...</div>
        </div>
      }
    >
      <BoardContent />
    </Suspense>
  );
}

"use client";

import React from "react";
import { GameWithMoves } from "@/types/chess";

interface GameStatusPanelProps {
  game?: GameWithMoves | null;
  currentTurn: "white" | "black";
  gameStatus: string;
  moveHistory: string[];
  capturedPieces: { white: string[]; black: string[] };
}

export const GameStatusPanel: React.FC<GameStatusPanelProps> = ({
  currentTurn,
  gameStatus,
  moveHistory,
  capturedPieces,
}) => {
  const pieceSymbols: { [key: string]: string } = {
    p: "♟",
    r: "♜",
    n: "♞",
    b: "♝",
    q: "♛",
    k: "♚",
  };

  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 w-80 text-white">
      {/* Timer removed */}

      {/* Game Info */}
      <div className="mb-6 space-y-2">
        <div className="flex justify-between">
          <span className="text-gray-400">Total turns:</span>
          <span>{Math.ceil(moveHistory.length / 2) || 1}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Current team:</span>
          <span className="capitalize">{currentTurn}</span>
        </div>
      </div>

      {/* Captured Pieces */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">Captured Pieces</h3>

        {/* Black captured pieces (captured by white) */}
        <div className="mb-2">
          <div className="text-sm text-gray-400 mb-1">
            Black pieces captured:
          </div>
          <div className="flex flex-wrap gap-1">
            {capturedPieces.black.map((piece, index) => (
              <span key={index} className="text-xl text-gray-300">
                {pieceSymbols[piece.toLowerCase()] || piece}
              </span>
            ))}
            {capturedPieces.black.length === 0 && (
              <span className="text-gray-500 text-sm">None</span>
            )}
          </div>
        </div>

        {/* White captured pieces (captured by black) */}
        <div>
          <div className="text-sm text-gray-400 mb-1">
            White pieces captured:
          </div>
          <div className="flex flex-wrap gap-1">
            {capturedPieces.white.map((piece, index) => (
              <span key={index} className="text-xl text-white">
                {pieceSymbols[piece.toLowerCase()] || piece}
              </span>
            ))}
            {capturedPieces.white.length === 0 && (
              <span className="text-gray-500 text-sm">None</span>
            )}
          </div>
        </div>
      </div>

      {/* Move History */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Move History</h3>
        <div className="bg-gray-900 rounded-lg p-3 max-h-40 overflow-y-auto">
          {moveHistory.length > 0 ? (
            <div className="space-y-1">
              {moveHistory.map((move, index) => {
                const moveNumber = Math.floor(index / 2) + 1;
                const isWhiteMove = index % 2 === 0;

                return (
                  <div key={index} className="text-sm">
                    {isWhiteMove && (
                      <span className="text-gray-400 mr-2">{moveNumber}.</span>
                    )}
                    <span className="font-mono">{move}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-gray-500 text-sm text-center">
              No moves yet
            </div>
          )}
        </div>
      </div>

      {/* Game Status */}
      {gameStatus !== "active" && (
        <div className="mt-4 p-3 bg-yellow-900 border border-yellow-600 rounded-lg">
          <div className="text-yellow-200 text-sm font-medium text-center">
            Game Over:{" "}
            {gameStatus.charAt(0).toUpperCase() + gameStatus.slice(1)}
          </div>
        </div>
      )}
    </div>
  );
};

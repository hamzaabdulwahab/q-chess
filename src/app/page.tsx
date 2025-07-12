"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function Home() {
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);

  const startNewGame = () => {
    // Generate a simple timestamp-based game ID for client-side games
    const gameId = Date.now().toString();
    setCurrentGameId(gameId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            ♛ Chess Game ♛
          </h1>
          <p className="text-gray-600">
            Play chess with our beautiful, interactive board
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              Ready to Play?
            </h2>
            <p className="text-gray-600 mb-6">
              Start a new game and enjoy playing chess with all the standard
              rules including castling, en passant, and pawn promotion.
            </p>

            <div className="space-y-4">
              <button
                onClick={startNewGame}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
              >
                🎮 Start New Game
              </button>

              {currentGameId && (
                <div className="mt-4">
                  <Link
                    href={`/board?id=${currentGameId}`}
                    className="inline-block bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
                  >
                    ▶️ Play Game
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">♟️</span>
              <span className="text-gray-700">Full chess piece movement</span>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-2xl">🎯</span>
              <span className="text-gray-700">Legal move validation</span>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-2xl">🏰</span>
              <span className="text-gray-700">Castling support</span>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-2xl">👑</span>
              <span className="text-gray-700">Pawn promotion</span>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-2xl">🔊</span>
              <span className="text-gray-700">Sound effects</span>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-2xl">📱</span>
              <span className="text-gray-700">Responsive design</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

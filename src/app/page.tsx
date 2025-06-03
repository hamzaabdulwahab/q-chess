"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface Game {
  id: number;
  status: string;
  move_count: number;
  current_player: string;
  created_at: Date;
  updated_at: Date;
  winner?: string;
}

export default function Home() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGames();
  }, []);

  const fetchGames = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/games");
      const data = await response.json();

      if (response.ok) {
        setGames(data.games || []);
      } else {
        setError(data.error || "Failed to fetch games");
      }
    } catch (err) {
      setError("Failed to fetch games");
      console.error("Error fetching games:", err);
    } finally {
      setLoading(false);
    }
  };

  const createNewGame = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/games", {
        method: "POST",
      });
      const data = await response.json();

      if (response.ok) {
        window.location.href = `/board?id=${data.gameId}`;
      } else {
        setError(data.error || "Failed to create game");
        setLoading(false);
      }
    } catch (err) {
      setError("Failed to create game");
      setLoading(false);
      console.error("Error creating game:", err);
    }
  };

  const deleteGame = async (gameId: number) => {
    try {
      const response = await fetch(`/api/games?id=${gameId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setGames(games.filter((game) => game.id !== gameId));
      } else {
        const data = await response.json();
        setError(data.error || "Failed to delete game");
      }
    } catch (err) {
      setError("Failed to delete game");
      console.error("Error deleting game:", err);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "text-green-400";
      case "checkmate":
        return "text-red-400";
      case "draw":
        return "text-yellow-400";
      case "stalemate":
        return "text-gray-400";
      default:
        return "text-gray-400";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return "🎮";
      case "checkmate":
        return "👑";
      case "draw":
        return "🤝";
      case "stalemate":
        return "⚖️";
      default:
        return "❓";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-amber-400 to-yellow-600 bg-clip-text text-transparent">
            ♔ Chess Master ♛
          </h1>
          <p className="text-gray-400 text-lg">
            Play chess with advanced game tracking and analysis
          </p>
        </div>

        {/* New Game Button */}
        <div className="text-center mb-12">
          <button
            onClick={createNewGame}
            className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold py-4 px-8 rounded-lg text-xl transition-all duration-200 transform hover:scale-105 shadow-lg"
          >
            🎯 Start New Game
          </button>
          <p className="text-gray-400 mt-2">
            Begin a fresh chess match with full game tracking
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-900 border border-red-600 text-red-100 px-4 py-3 rounded-lg mb-6">
            <span className="block sm:inline">{error}</span>
            <button
              onClick={() => setError(null)}
              className="float-right text-red-100 hover:text-white"
            >
              ×
            </button>
          </div>
        )}

        {/* Games List */}
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Your Games</h2>
            <button
              onClick={fetchGames}
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              🔄 Refresh
            </button>
          </div>

          {games.length === 0 ? (
            <div className="bg-gray-800 border border-gray-600 rounded-lg p-8 text-center">
              <div className="text-6xl mb-4">♝</div>
              <h3 className="text-xl font-semibold mb-2">No games yet</h3>
              <p className="text-gray-400 mb-4">
                Start your first chess game to see it appear here
              </p>
              <button
                onClick={createNewGame}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Create First Game
              </button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {games.map((game) => (
                <div
                  key={game.id}
                  className="bg-gray-800 border border-gray-600 rounded-lg p-6 hover:border-gray-500 transition-colors"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-1">
                        Game #{game.id}
                      </h3>
                      <div className="flex items-center space-x-2">
                        <span>{getStatusIcon(game.status)}</span>
                        <span
                          className={`text-sm font-medium ${getStatusColor(
                            game.status
                          )}`}
                        >
                          {game.status.charAt(0).toUpperCase() +
                            game.status.slice(1)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteGame(game.id)}
                      className="text-red-400 hover:text-red-300 transition-colors text-sm"
                      title="Delete game"
                    >
                      🗑️
                    </button>
                  </div>

                  <div className="space-y-2 mb-4 text-sm text-gray-400">
                    <div className="flex justify-between">
                      <span>Moves:</span>
                      <span>{game.move_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Current turn:</span>
                      <span className="capitalize">{game.current_player}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Created:</span>
                      <span>{formatDate(game.created_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Last played:</span>
                      <span>{formatDate(game.updated_at)}</span>
                    </div>
                    {game.winner && (
                      <div className="flex justify-between">
                        <span>Winner:</span>
                        <span className="capitalize font-medium text-yellow-400">
                          {game.winner}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex space-x-2">
                    <Link
                      href={`/board?id=${game.id}`}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-center py-2 px-4 rounded-lg transition-colors text-sm font-medium"
                    >
                      {game.status === "active" ? "▶️ Resume" : "👁️ View"}
                    </Link>
                    <Link
                      href={`/board`}
                      className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors text-sm"
                      title="New game"
                    >
                      ➕
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center text-gray-500 text-sm">
          <p>© 2025 Chess Master - Built with Next.js, MySQL, and chess.js</p>
        </footer>
      </div>
    </div>
  );
}

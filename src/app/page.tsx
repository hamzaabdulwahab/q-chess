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
  totalMoves: number;
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
          <div className="relative">
            <h1 className="text-6xl md:text-7xl font-bold mb-4 bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-400 bg-clip-text text-transparent">
              ♔ For My Queen ♛
            </h1>
            <div className="absolute inset-0 text-6xl md:text-7xl font-bold bg-gradient-to-r from-amber-600 via-yellow-500 to-orange-600 bg-clip-text text-transparent blur-sm opacity-30">
              ♔ For My Queen ♛
            </div>
          </div>
          <p className="text-amber-200 text-xl font-medium">
            Elite Chess • Strategic Mastery • Royal Excellence
          </p>
          <div className="flex justify-center items-center mt-4 space-x-4">
            <div className="w-16 h-px bg-gradient-to-r from-transparent via-amber-400 to-transparent"></div>
            <span className="text-amber-400 text-sm font-semibold">
              PREMIUM EXPERIENCE
            </span>
            <div className="w-16 h-px bg-gradient-to-r from-transparent via-amber-400 to-transparent"></div>
          </div>
        </div>

        {/* New Game Button */}
        <div className="text-center mb-12">
          <button
            onClick={createNewGame}
            className="bg-gradient-to-r from-amber-600 via-yellow-600 to-orange-600 hover:from-amber-700 hover:via-yellow-700 hover:to-orange-700 text-white font-bold py-5 px-10 rounded-xl text-xl transition-all duration-300 transform hover:scale-105 shadow-2xl hover:shadow-amber-500/30 border border-amber-400/30"
          >
            ♔ Start New Royal Match ♛
          </button>
          <p className="text-amber-200 mt-3 font-medium tracking-wide">
            Begin a strategic challenge worthy of royalty
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
            <h2 className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
              Game Archive
            </h2>
            <button
              onClick={fetchGames}
              className="text-amber-400 hover:text-amber-300 transition-colors flex items-center space-x-2"
            >
              <span>🔄</span>
              <span>Refresh</span>
            </button>
          </div>

          {games.length === 0 ? (
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-amber-500/30 rounded-xl p-8 text-center shadow-2xl">
              <div className="text-7xl mb-4">♔</div>
              <h3 className="text-2xl font-semibold mb-2 text-amber-300">
                No games yet
              </h3>
              <p className="text-amber-200 mb-6 font-medium">
                Create your first strategic challenge
              </p>
              <button
                onClick={createNewGame}
                className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white px-8 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                ♔ Create First Match
              </button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {games.map((game) => (
                <div
                  key={game.id}
                  className="bg-gradient-to-br from-gray-800 to-gray-900 border border-amber-500/20 rounded-xl p-6 hover:border-amber-400/50 transition-all duration-300 transform hover:scale-105 shadow-xl hover:shadow-amber-500/20"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-1 text-amber-300">
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
                      className="text-red-400 hover:text-red-300 transition-colors text-sm hover:scale-110 transform"
                      title="Delete game"
                    >
                      🗑️
                    </button>
                  </div>

                  <div className="space-y-2 mb-4 text-sm text-gray-400">
                    <div className="flex justify-between">
                      <span>Moves:</span>
                      <span>{game.totalMoves}</span>
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
                      className="flex-1 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white text-center py-2 px-4 rounded-lg transition-colors text-sm font-medium"
                    >
                      {game.status === "active" ? "▶️ Resume" : "👁️ View"}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

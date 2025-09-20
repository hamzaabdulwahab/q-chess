"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  RefreshCw,
  Play,
  Eye,
  ArrowLeft,
  Trash2,
  Crown,
  Handshake,
  Scale,
  HelpCircle,
} from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import {
  ArchiveFilters,
  type Category,
  type Winner,
} from "@/components/ArchiveFilters";
import { LoadingSpinner } from "@/components/LoadingSpinner";

interface Game {
  id: number;
  status: string;
  move_count: number;
  current_player: string;
  fen?: string;
  created_at: Date;
  updated_at: Date;
  winner?: string;
  totalMoves: number;
  // Derived (client only)
  derivedWinner?: string;
  derivedCheckmated?: string;
}

export default function ArchivePage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ArchivePageContent />
    </Suspense>
  );
}

function ArchivePageContent() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>("all");
  const [winner, setWinner] = useState<Winner>("all");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const check = async () => {
      const supabase = getSupabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.replace("/auth/signin");
        return;
      }
      fetchGames();
    };
    check();
  }, []);

  // Initialize filters from URL (cat, win)
  useEffect(() => {
    const cat = (searchParams.get("cat") || "").toLowerCase();
    const win = (searchParams.get("win") || "").toLowerCase();
    const cats: Category[] = [
      "all",
      "active",
      "completed",
      "checkmate",
      "draw",
      "stalemate",
    ];
    const wins: Winner[] = ["all", "white", "black", "draw", "none"];
    if (cats.includes(cat as Category)) setCategory(cat as Category);
    if (wins.includes(win as Winner)) setWinner(win as Winner);
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist filters to URL (replace, no scroll)
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (category === "all") params.delete("cat");
    else params.set("cat", category);
    if (winner === "all") params.delete("win");
    else params.set("win", winner);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [category, winner, pathname, router, searchParams]);

  const fetchGames = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/games");
      
      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response');
      }
      
      const data = await response.json();
      if (response.ok) {
        const rawGames: Game[] = data.games || [];
        // Derive authoritative winner/loser for checkmate cases.
        const normalized = rawGames.map(g => {
          if (g.status !== 'checkmate') return { ...g };

          let derivedWinner: string | undefined;
          let derivedCheckmated: string | undefined;

          // Primary: Trust stored winner if it exists and is valid
          if (g.winner === 'white' || g.winner === 'black') {
            derivedWinner = g.winner;
            derivedCheckmated = g.winner === 'white' ? 'black' : 'white';
          }

          // Secondary: If no stored winner, use current_player as loser (since it's side to move after checkmate)
          if (!derivedWinner && (g.current_player === 'white' || g.current_player === 'black')) {
            derivedCheckmated = g.current_player; // loser
            derivedWinner = g.current_player === 'white' ? 'black' : 'white';
          }

          // Tertiary: FEN token cross-check for validation
          if (g.fen) {
            try {
              const parts = g.fen.split(' ');
              const turnToken = parts[1];
              const fenLoser = turnToken === 'w' ? 'white' : 'black';
              const fenWinner = fenLoser === 'white' ? 'black' : 'white';
              
              // Only override if we have no other derivation, or for debugging mismatch
              if (!derivedWinner) {
                derivedWinner = fenWinner;
                derivedCheckmated = fenLoser;
              }
            } catch {
              // Ignore parse errors
            }
          }

          // Quaternary fallback: move_count parity (odd move_count => white just moved, so winner white)
          if (!derivedWinner && typeof g.move_count === 'number') {
            const lastMover = g.move_count % 2 === 1 ? 'white' : 'black';
            derivedWinner = lastMover;
            derivedCheckmated = lastMover === 'white' ? 'black' : 'white';
          }

          // If still no derived winner, fallback to stored field
          if (!derivedWinner && (g.winner === 'white' || g.winner === 'black')) {
            derivedWinner = g.winner;
            derivedCheckmated = g.winner === 'white' ? 'black' : 'white';
          }

          return { ...g, derivedWinner, derivedCheckmated };
        });
        setGames(normalized);
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

  const deleteGame = async (gameId: number) => {
    try {
      const response = await fetch(`/api/games?id=${gameId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setGames(games.filter((game) => game.id !== gameId));
      } else {
        // Check if response is JSON before parsing
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          setError(data.error || "Failed to delete game");
        } else {
          setError("Failed to delete game - server error");
        }
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
    const cls = "w-4 h-4";
    switch (status) {
      case "active":
        return <Play className={cls} />;
      case "checkmate":
        return <Crown className={cls} />;
      case "draw":
        return <Handshake className={cls} />;
      case "stalemate":
        return <Scale className={cls} />;
      default:
        return <HelpCircle className={cls} />;
    }
  };

  const filteredGames = useMemo(() => {
    const completedStatuses = new Set(["checkmate", "stalemate", "draw"]);
    return games.filter((g) => {
      if (category === "active" && g.status !== "active") return false;
      if (category === "completed" && !completedStatuses.has(g.status))
        return false;
      if (category === "checkmate" && g.status !== "checkmate") return false;
      if (category === "draw" && g.status !== "draw") return false;
      if (category === "stalemate" && g.status !== "stalemate") return false;
      if (winner !== "all") {
        if (winner === "none") {
          if (g.winner) return false;
        } else {
          if ((g.winner || "").toLowerCase() !== winner) return false;
        }
      }
      return true;
    });
  }, [games, category, winner]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-accent hover:opacity-90 transition-colors flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </Link>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
            Game Archive
          </h1>
          <button
            onClick={fetchGames}
            className="text-accent hover:opacity-90 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>

        <div className="sticky top-20 z-30">
          <ArchiveFilters
            className="mb-8"
            category={category}
            onCategoryChange={setCategory}
            winner={winner}
            onWinnerChange={setWinner}
            total={games.length}
            filtered={filteredGames.length}
          />
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <div className="text-center text-red-400">{error}</div>
        ) : games.length === 0 ? (
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-accent/30 rounded-xl p-8 text-center shadow-2xl">
            <div className="text-7xl mb-4">♔</div>
            <h3 className="text-2xl font-semibold mb-2 text-accent">
              No archived games yet
            </h3>
            <p className="text-accent mb-6 font-medium">
              Start a match from the home page
            </p>
            <Link
              href="/"
              className="btn-accent text-black px-8 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg inline-block"
            >
              ♔ Home
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredGames.map((game) => (
              <div
                key={game.id}
                className="bg-gradient-to-br from-gray-800 to-gray-900 border border-accent/20 rounded-xl p-6 hover:border-accent transition-all duration-300 transform hover:scale-105 shadow-xl hover:shadow-violet-600/20"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-1 text-accent">
                      Game #{game.id}
                    </h3>
                    <div className="flex items-center space-x-2">
                      <span>{getStatusIcon(game.status)}</span>
                      <span
                        className={`text-sm font-medium ${getStatusColor(
                          game.status,
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
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2 mb-4 text-sm text-gray-400">
                  <div className="flex justify-between">
                    <span>Moves:</span>
                    <span>{game.totalMoves}</span>
                  </div>
                            {game.status === 'checkmate' ? (
                              (() => {
                                const winner = game.derivedWinner || game.winner;
                                const loser = game.derivedCheckmated || (winner === 'white' ? 'black' : 'white');
                                return (
                                  <>
                                    <div className="flex justify-between">
                                      <span>Winner:</span>
                                      <span className="capitalize font-medium text-yellow-400">{winner}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Checkmated:</span>
                                      <span className="capitalize text-red-300">{loser}</span>
                                    </div>
                                  </>
                                );
                              })()
                            ) : (
                              <div className="flex justify-between">
                                <span>Current turn:</span>
                                <span className="capitalize">{game.current_player}</span>
                              </div>
                            )}
                  <div className="flex justify-between">
                    <span>Created:</span>
                    <span>{formatDate(game.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last played:</span>
                    <span>{formatDate(game.updated_at)}</span>
                  </div>
                            {game.winner && game.status !== 'checkmate' && !game.derivedWinner && (
                    <div className="flex justify-between">
                      <span>Winner:</span>
                      <span className="capitalize font-medium text-yellow-400">{game.winner}</span>
                    </div>
                  )}
                </div>

                <div className="flex space-x-2">
                  <Link
                    href={`/board?id=${game.id}`}
                    className="flex-1 btn-accent text-black text-center py-2 px-4 rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-2"
                  >
                    {game.status === "active" ? (
                      <>
                        <Play className="w-4 h-4" />
                        <span>Resume</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4" />
                        <span>View</span>
                      </>
                    )}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

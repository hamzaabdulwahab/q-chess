"use client";

import React, { useState, useEffect, Suspense } from "react";
import {
  RefreshCw,
  Play,
  Eye,
  Trash2,
  Crown,
  Handshake,
  Scale,
  HelpCircle,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { Alert } from "@/components/Alert";
import { NewGameModal, type NewGameChoice } from "@/components/NewGameModal";
import {
  ArchiveFilters,
  type Category,
  type Winner,
} from "@/components/ArchiveFilters";

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
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-900 flex items-center justify-center text-accent">
          Loading...
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [showNewGameModal, setShowNewGameModal] = useState(false);
  const [category, setCategory] = useState<Category>("all");
  const [winner, setWinner] = useState<Winner>("all");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check auth first; if not signed in, send to signin
    const check = async () => {
      const supabase = getSupabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        // redirect to signin page
        window.location.replace("/auth/signin");
        return;
      }
      setAuthed(true);
      fetchGames();
    };
    check();
  }, []);

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
      
      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response');
      }
      
      const data = await response.json();

      if (response.ok) {
        window.location.href = `/board?id=${data.gameId}`;
      } else {
        if (response.status === 401) {
          // Not signed in: go to signin instead of showing an error
          window.location.href = "/auth/signin";
          return;
        }
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

  const handleNewGameChoice = async (choice: NewGameChoice) => {
    setShowNewGameModal(false);
    if (!choice) return;

    if (choice === "local-2v2") {
      // Create a traditional local database game
      await createNewGame();
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

  // Initialize filters from URL once
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist filters to URL when they change
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (category === "all") params.delete("cat");
    else params.set("cat", category);
    if (winner === "all") params.delete("win");
    else params.set("win", winner);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [category, winner, pathname, router, searchParams]);

  const filteredGames = React.useMemo(() => {
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

  if (authed === null || loading) {
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
        <div className="relative text-center mb-12">
          <div className="relative">
            <h1 className="text-6xl md:text-7xl font-bold mb-4 bg-gradient-to-r from-violet-300 via-violet-200 to-fuchsia-300 bg-clip-text text-transparent">
              ♔ Q-Chess ♛
            </h1>
            <div className="absolute inset-0 text-6xl md:text-7xl font-bold bg-gradient-to-r from-violet-600 via-violet-500 to-fuchsia-600 bg-clip-text text-transparent blur-sm opacity-30">
              ♔ Q-Chess ♛
            </div>
          </div>
          <p className="text-accent text-xl font-medium">
            Elite Chess • Strategic Mastery • Royal Excellence
          </p>
          <div className="flex justify-center items-center mt-4 space-x-4">
            <div className="w-16 h-px bg-gradient-to-r from-transparent via-violet-400 to-transparent"></div>
            <span className="text-accent text-sm font-semibold">
              PREMIUM EXPERIENCE
            </span>
            <div className="w-16 h-px bg-gradient-to-r from-transparent via-violet-400 to-transparent"></div>
          </div>
        </div>

        {/* New Game Button */}
        <div className="text-center mb-12">
          <button
            onClick={() => setShowNewGameModal(true)}
            className="btn-accent text-black font-bold py-5 px-10 rounded-xl text-xl transition-all duration-300 transform hover:scale-105 shadow-2xl border border-accent/30"
          >
            ♔ Start New Royal Match ♛
          </button>
          <p className="text-accent mt-3 font-medium tracking-wide">
            Begin a strategic challenge worthy of royalty
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Games List */}
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
              Game Archive
            </h2>
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
              className="mb-6"
              category={category}
              onCategoryChange={setCategory}
              winner={winner}
              onWinnerChange={setWinner}
              total={games.length}
              filtered={filteredGames.length}
            />
          </div>

          {games.length === 0 ? (
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-accent/30 rounded-xl p-8 text-center shadow-2xl">
              <div className="text-7xl mb-4">♔</div>
              <h3 className="text-2xl font-semibold mb-2 text-accent">
                No games yet
              </h3>
              <p className="text-accent mb-6 font-medium">
                Create your first strategic challenge
              </p>
              <button
                onClick={() => setShowNewGameModal(true)}
                className="btn-accent text-black px-8 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                ♔ Create First Match
              </button>
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

        {/* Modals */}
        <NewGameModal
          open={showNewGameModal}
          onClose={() => setShowNewGameModal(false)}
          onChoose={handleNewGameChoice}
        />
      </div>
    </div>
  );
}

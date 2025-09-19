"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RefreshCw, Play, Eye, ArrowLeft } from "lucide-react";
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
  created_at: Date;
  updated_at: Date;
  winner?: string;
  totalMoves: number;
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
            <div className="text-7xl mb-4">\u2654</div>
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
              \u2654 Home
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
                    <div className="flex items-center space-x-2 text-sm text-gray-400">
                      <span className="capitalize">{game.status}</span>
                      <span>•</span>
                      <span>{game.totalMoves} moves</span>
                      {game.winner && (
                        <>
                          <span>•</span>
                          <span>Winner: {String(game.winner)}</span>
                        </>
                      )}
                    </div>
                  </div>
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

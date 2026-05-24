"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  ChevronRight,
  RefreshCw,
  Search,
  Trash2,
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
  const [search, setSearch] = useState("");
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
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned non-JSON response");
      }
      const data = await response.json();
      if (response.ok) {
        const rawGames: Game[] = data.games || [];
        const normalized = rawGames.map((g) => {
          if (g.status !== "checkmate") return { ...g };
          let derivedWinner: string | undefined;
          let derivedCheckmated: string | undefined;
          if (g.winner === "white" || g.winner === "black") {
            derivedWinner = g.winner;
            derivedCheckmated = g.winner === "white" ? "black" : "white";
          }
          if (
            !derivedWinner &&
            (g.current_player === "white" || g.current_player === "black")
          ) {
            derivedCheckmated = g.current_player;
            derivedWinner = g.current_player === "white" ? "black" : "white";
          }
          if (g.fen) {
            try {
              const parts = g.fen.split(" ");
              const turnToken = parts[1];
              const fenLoser = turnToken === "w" ? "white" : "black";
              const fenWinner = fenLoser === "white" ? "black" : "white";
              if (!derivedWinner) {
                derivedWinner = fenWinner;
                derivedCheckmated = fenLoser;
              }
            } catch {
              /* ignore */
            }
          }
          if (!derivedWinner && typeof g.move_count === "number") {
            const lastMover = g.move_count % 2 === 1 ? "white" : "black";
            derivedWinner = lastMover;
            derivedCheckmated = lastMover === "white" ? "black" : "white";
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
        setGames(games.filter((g) => g.id !== gameId));
      } else {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          setError(data.error || "Failed to delete game");
        } else {
          setError("Failed to delete game");
        }
      }
    } catch (err) {
      setError("Failed to delete game");
      console.error(err);
    }
  };

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const filteredGames = useMemo(() => {
    const completedStatuses = new Set(["checkmate", "stalemate", "draw"]);
    const q = search.trim().toLowerCase();
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
      if (q && !String(g.id).includes(q) && !g.status.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [games, category, winner, search]);

  // High-level stats — a small dashboard above the list.
  const stats = useMemo(() => {
    const total = games.length;
    const active = games.filter((g) => g.status === "active").length;
    const wins = games.filter((g) => g.winner && g.winner !== "draw").length;
    const draws = games.filter(
      (g) => g.status === "draw" || g.status === "stalemate",
    ).length;
    return { total, active, wins, draws };
  }, [games]);

  return (
    <div className="min-h-screen">
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        {/* Top bar */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="btn-ghost inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
          <h1 className="text-base font-semibold tracking-tight">
            Game archive
          </h1>
          <button
            type="button"
            onClick={fetchGames}
            className="btn-ghost inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm"
            aria-label="Refresh"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        {/* Stats strip */}
        <div className="surface-card mb-5 grid grid-cols-4 divide-x divide-[var(--border)]">
          {[
            { label: "Total", value: stats.total },
            { label: "Active", value: stats.active },
            { label: "Wins", value: stats.wins },
            { label: "Draws", value: stats.draws },
          ].map((s) => (
            <div key={s.label} className="px-4 py-3 text-center">
              <div
                className="text-lg font-semibold tabular-nums"
                style={{ color: "var(--text)" }}
              >
                {s.value}
              </div>
              <div
                className="text-[11px] uppercase tracking-wider"
                style={{ color: "var(--text-3)" }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Search + filters */}
        <div className="mb-3 flex gap-2">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
              style={{ color: "var(--text-3)" }}
            />
            <input
              type="search"
              placeholder="Search game number or status"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-8"
              style={{ paddingLeft: "2rem" }}
            />
          </div>
        </div>

        <div className="mb-4">
          <ArchiveFilters
            category={category}
            onCategoryChange={setCategory}
            winner={winner}
            onWinnerChange={setWinner}
            total={games.length}
            filtered={filteredGames.length}
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="surface-card p-10 text-center text-sm text-muted">
            Loading games…
          </div>
        ) : error ? (
          <div
            className="rounded-md px-3 py-2 text-sm"
            style={{
              background: "var(--danger-soft)",
              color: "var(--text)",
              border:
                "1px solid color-mix(in oklch, var(--danger) 40%, transparent)",
            }}
            role="alert"
          >
            {error}
          </div>
        ) : games.length === 0 ? (
          <div className="surface-card flex flex-col items-center justify-center px-6 py-14 text-center">
            <div className="text-3xl" style={{ color: "var(--text-3)" }}>
              ♞
            </div>
            <p
              className="mt-3 text-base font-medium"
              style={{ color: "var(--text)" }}
            >
              No games yet
            </p>
            <p className="mt-1 text-sm text-muted">
              Start a match from the home page.
            </p>
            <Link
              href="/"
              className="btn-accent mt-5 inline-flex items-center rounded-md px-4 py-2 text-sm"
            >
              Back to home
            </Link>
          </div>
        ) : filteredGames.length === 0 ? (
          <div className="surface-card px-6 py-10 text-center text-sm text-muted">
            No games match your filters.
          </div>
        ) : (
          <ul className="surface-card divide-y divide-[var(--border)] overflow-hidden">
            {filteredGames.map((game) => {
              const isCheckmate = game.status === "checkmate";
              const winnerColor = isCheckmate
                ? game.derivedWinner || game.winner
                : game.winner;
              return (
                <li key={game.id}>
                  <div className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-1)]">
                    <StatusPill status={game.status} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span
                          className="text-sm font-medium tabular-nums"
                          style={{ color: "var(--text)" }}
                        >
                          Game #{game.id}
                        </span>
                        <span
                          className="text-xs tabular-nums"
                          style={{ color: "var(--text-3)" }}
                        >
                          {game.totalMoves} moves
                        </span>
                      </div>
                      <div
                        className="mt-0.5 text-xs"
                        style={{ color: "var(--text-3)" }}
                      >
                        {formatDate(game.updated_at)}
                      </div>
                    </div>

                    {/* Result column */}
                    <div className="hidden text-right sm:block">
                      {winnerColor ? (
                        <div className="text-sm">
                          <span
                            className="font-semibold capitalize"
                            style={{ color: "var(--text)" }}
                          >
                            {winnerColor}
                          </span>
                          <span
                            className="text-xs"
                            style={{ color: "var(--text-3)" }}
                          >
                            {" "}
                            {winnerColor === "draw" ? "agreed" : "won"}
                          </span>
                        </div>
                      ) : game.status === "active" ? (
                        <div className="text-xs" style={{ color: "var(--text-3)" }}>
                          <span className="capitalize">
                            {game.current_player}
                          </span>{" "}
                          to move
                        </div>
                      ) : (
                        <div className="text-xs" style={{ color: "var(--text-3)" }}>
                          —
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => deleteGame(game.id)}
                        className="rounded p-1 opacity-0 transition-opacity group-hover:opacity-100"
                        style={{ color: "var(--text-3)" }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.color = "oklch(0.7 0.16 25)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color = "var(--text-3)")
                        }
                        title="Delete game"
                        aria-label="Delete game"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      {game.status !== "active" && (
                        <Link
                          href={`/board/${game.id}/review`}
                          className="btn-ghost inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs"
                          title="Open Game Review"
                        >
                          <BarChart3 className="h-3 w-3" />
                          Review
                        </Link>
                      )}
                      <Link
                        href={`/board?id=${game.id}`}
                        className="btn-secondary inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs"
                      >
                        {game.status === "active" ? "Resume" : "View"}
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { dot: string; label: string }> = {
    active: { dot: "oklch(0.72 0.13 145)", label: "Active" },
    checkmate: { dot: "var(--text)", label: "Mate" },
    draw: { dot: "var(--text-3)", label: "Draw" },
    stalemate: { dot: "var(--text-3)", label: "Stale" },
    resigned: { dot: "oklch(0.66 0.14 25)", label: "Resign" },
    timeout: { dot: "oklch(0.66 0.14 25)", label: "Time" },
    abandoned: { dot: "var(--text-3)", label: "Abnd" },
  };
  const m = map[status] || { dot: "var(--text-3)", label: status };
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium uppercase tracking-wider"
      style={{
        background: "var(--surface-1)",
        color: "var(--text-2)",
        border: "1px solid var(--border-strong)",
        minWidth: "4.5rem",
        justifyContent: "center",
      }}
    >
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: m.dot }}
      />
      {m.label}
    </span>
  );
}

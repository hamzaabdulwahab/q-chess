"use client";

import React, { useState, useEffect, Suspense } from "react";
import {
  RefreshCw,
  Play,
  Eye,
  Trash2,
  Handshake,
  Scale,
  HelpCircle,
  Inbox,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { Alert } from "@/components/Alert";
import { NewGameModal, type NewGameChoice } from "@/components/NewGameModal";
import { InviteUserModal } from "@/components/InviteUserModal";
import { InvitesInboxModal } from "@/components/InvitesInboxModal";
import { BotGameModal } from "@/components/BotGameModal";
import { LobbyOnlineUsers } from "@/components/LobbyOnlineUsers";
import { ChessLayout } from "@/components/ChessLayout";
import type { CurrentUserIdentity } from "@/lib/multiplayer/types";
import {
  ArchiveFilters,
  type Category,
  type Winner,
} from "@/components/ArchiveFilters";
import { AppIcon } from "@/components/AppIcon";

interface Game {
  id: number;
  status: string;
  move_count: number;
  current_player: string;
  created_at: Date;
  updated_at: Date;
  winner?: string;
  totalMoves: number;
  white_user_id?: string | null;
  black_user_id?: string | null;
  time_control_initial_ms?: number | null;
  increment_ms?: number;
}

export default function Home() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
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
  const [inviteComposerOpen, setInviteComposerOpen] = useState(false);
  const [inviteComposerPrefill, setInviteComposerPrefill] = useState<
    string | undefined
  >(undefined);
  const [invitesInboxOpen, setInvitesInboxOpen] = useState(false);
  const [botGameOpen, setBotGameOpen] = useState(false);
  const [pendingInvitesCount, setPendingInvitesCount] = useState(0);
  const [me, setMe] = useState<CurrentUserIdentity | null>(null);
  const [category, setCategory] = useState<Category>("all");
  const [winner, setWinner] = useState<Winner>("all");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const refreshPendingInvitesCount = React.useCallback(async () => {
    try {
      const res = await fetch("/api/invites?direction=incoming", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        invites?: { status?: string }[];
      };
      const pending = (data.invites ?? []).filter(
        (inv) => inv.status === "pending",
      ).length;
      setPendingInvitesCount(pending);
    } catch {
      // Silent — badge just won't update; user can still open the inbox manually.
    }
  }, []);

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
      refreshPendingInvitesCount();

      try {
        const profileRes = await fetch("/api/profile", { cache: "no-store" });
        if (profileRes.ok) {
          const profile = (await profileRes.json()) as {
            id?: string;
            username?: string | null;
            full_name?: string | null;
            avatar_url?: string | null;
          };
          if (profile.id && profile.username) {
            setMe({
              id: profile.id,
              username: profile.username,
              fullName: profile.full_name ?? null,
              avatarUrl: profile.avatar_url ?? null,
            });
          }
        }
      } catch {
        // Presence stays disabled if profile fetch fails; lobby UI degrades silently.
      }
    };
    check();
  }, [refreshPendingInvitesCount]);

  // Listen for invite updates globally to notify sender when invite is accepted
  useEffect(() => {
    if (!authed) return;

    const supabase = getSupabaseBrowser();
    const channel = supabase
      .channel('invites-global-listener')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invites' },
        (payload) => {
          // Any invite change (insert/update/delete) potentially affects our badge count.
          refreshPendingInvitesCount();

          // When an invite is updated, check if it's our outgoing invite that was accepted
          if (payload.eventType === 'UPDATE') {
            const updatedInvite = payload.new as {
              from_user_id?: string;
              to_user_id?: string;
              status?: string;
              game_id?: number | null;
            };

            // If we're the sender and the invite was accepted with a game ID
            if (updatedInvite.game_id && updatedInvite.status === 'accepted') {
              // Check if this invite was from us by fetching our user ID
              supabase.auth.getUser().then(({ data: { user } }) => {
                if (user && updatedInvite.from_user_id === user.id) {
                  router.push(
                    `/board?id=${updatedInvite.game_id}&mode=remote`,
                  );
                }
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authed, router, refreshPendingInvitesCount]);

  const fetchGames = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/games", { cache: 'no-store' });
      
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
      await createNewGame();
    } else if (choice === "invite-user") {
      setInviteComposerOpen(true);
    } else if (choice === "invites-inbox") {
      setInvitesInboxOpen(true);
    } else if (choice === "play-vs-bot") {
      setBotGameOpen(true);
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
        return "text-[oklch(0.72_0.13_145)]"; // alive — muted green
      case "checkmate":
        return "text-[var(--accent)]";
      case "draw":
      case "stalemate":
        return "text-[var(--text-2)]";
      case "resigned":
      case "timeout":
        return "text-[oklch(0.66_0.14_25)]"; // muted red
      case "abandoned":
        return "text-[var(--text-3)]";
      default:
        return "text-[var(--text-3)]";
    }
  };

  const getStatusIcon = (status: string) => {
    const cls = "w-4 h-4";
    switch (status) {
      case "active":
        return <AppIcon icon={Play} className={cls} />;
      case "checkmate":
        return <AppIcon icon={Trophy} className={cls} />;
      case "draw":
        return <AppIcon icon={Handshake} className={cls} />;
      case "stalemate":
        return <AppIcon icon={Scale} className={cls} />;
      default:
        return <AppIcon icon={HelpCircle} className={cls} />;
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

  // Active multiplayer game for the current user, if any. Used to render
  // the resume-game banner so the user is never stranded after wandering
  // away from a live game.
  const activeMultiplayerGame = React.useMemo(() => {
    if (!me) return null;
    return (
      games.find(
        (g) =>
          g.status === "active" &&
          g.white_user_id &&
          g.black_user_id &&
          (g.white_user_id === me.id || g.black_user_id === me.id),
      ) ?? null
    );
  }, [games, me]);

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

  if (authed === null) {
    return <LoadingSpinner />;
  }

  if (loading) {
    return (
      <ChessLayout
        title="Play"
        subtitle={me?.username ? `Signed in as @${me.username}` : "Play chess online"}
      >
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="surface-card p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="h-4 w-28 rounded bg-[var(--surface-2)]" />
              <div className="h-8 w-24 rounded-md bg-[var(--surface-1)]" />
            </div>
            <div className="space-y-2">
              {[0, 1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-12 rounded-md bg-[var(--surface-1)]"
                  style={{ opacity: 1 - item * 0.12 }}
                />
              ))}
            </div>
          </div>
          <div className="surface-card p-4">
            <div className="h-4 w-32 rounded bg-[var(--surface-2)]" />
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="aspect-[4/3] rounded-md bg-[var(--surface-1)]"
                  style={{ opacity: 1 - item * 0.1 }}
                />
              ))}
            </div>
          </div>
        </div>
      </ChessLayout>
    );
  }

  return (
    <ChessLayout
      title="Play"
      subtitle={me?.username ? `Signed in as @${me.username}` : "Play chess online"}
      actions={
        <>
            <button
              type="button"
              onClick={() => setInvitesInboxOpen(true)}
              className="btn-secondary relative inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm"
            >
              <AppIcon icon={Inbox} className="h-4 w-4" />
              Invitations
              {pendingInvitesCount > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold"
                  style={{
                    background: "var(--accent)",
                    color: "var(--accent-fg)",
                    boxShadow: "0 0 0 2px var(--bg)",
                  }}
                >
                  {pendingInvitesCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowNewGameModal(true)}
              className="btn-accent inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-sm"
            >
              <AppIcon icon={Play} className="h-4 w-4" />
              New game
            </button>
        </>
      }
    >

        {error && (
          <div className="mb-6">
            <Alert variant="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          </div>
        )}

        {/* Resume game banner — only shown when the user has an active
            multiplayer game. Catches the case where they navigated away
            after sending/accepting an invite. */}
        {activeMultiplayerGame && me && (
          <div
            className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md px-4 py-3"
            style={{
              background: "var(--accent-soft)",
              border:
                "1px solid color-mix(in oklch, var(--accent) 35%, transparent)",
            }}
            role="status"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{
                  background: "var(--accent)",
                  boxShadow: "0 0 8px var(--accent)",
                }}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <div
                  className="text-sm font-semibold truncate"
                  style={{ color: "var(--text)" }}
                >
                  Game in progress
                </div>
                <div className="text-xs text-muted">
                  Your turn{" "}
                  {activeMultiplayerGame.current_player ===
                  (activeMultiplayerGame.white_user_id === me.id
                    ? "white"
                    : "black")
                    ? "now"
                    : `(${activeMultiplayerGame.current_player} to move)`}{" "}
                  · Game #{activeMultiplayerGame.id}
                </div>
              </div>
            </div>
            <Link
              href={`/board?id=${activeMultiplayerGame.id}`}
              className="btn-accent inline-flex shrink-0 items-center gap-2 rounded-md px-3.5 py-1.5 text-sm"
            >
              <AppIcon icon={Play} className="h-3.5 w-3.5" />
              Resume game
            </Link>
          </div>
        )}

        {/* Lobby — online users */}
        <LobbyOnlineUsers
          me={me}
          onChallenge={(user) => {
            setInviteComposerPrefill(user.username);
            setInviteComposerOpen(true);
          }}
        />

        {/* Archive */}
        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight">
              Recent games
            </h2>
            <button
              type="button"
              onClick={fetchGames}
              className="btn-ghost inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs"
              aria-label="Refresh games"
            >
              <AppIcon icon={RefreshCw} className="h-3.5 w-3.5" />
              Refresh
            </button>
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

          {games.length === 0 ? (
            <div
              className="surface-card flex flex-col items-center justify-center px-6 py-14 text-center"
            >
              <p className="text-base font-medium" style={{ color: "var(--text)" }}>
                No games yet
              </p>
              <p className="mt-1 text-sm text-muted">
                Challenge someone in the lobby, or start a new game.
              </p>
              <button
                type="button"
                onClick={() => setShowNewGameModal(true)}
                className="btn-accent mt-5 rounded-md px-4 py-2 text-sm"
              >
                Start a game
              </button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredGames.map((game) => (
                <article
                  key={game.id}
                  className="surface-card group p-4 transition-colors hover:bg-[var(--surface-1)]"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <div className="text-xs font-medium text-muted">
                        Game #{game.id}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-sm font-medium">
                        <span className="opacity-80">{getStatusIcon(game.status)}</span>
                        <span className={getStatusColor(game.status)}>
                          {game.status.charAt(0).toUpperCase() +
                            game.status.slice(1)}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteGame(game.id)}
                      className="rounded p-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
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
                      <AppIcon icon={Trash2} className="h-4 w-4" />
                    </button>
                  </div>

                  <dl className="mb-4 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <dt className="text-muted">Moves</dt>
                    <dd className="text-right" style={{ color: "var(--text-2)" }}>
                      {game.totalMoves}
                    </dd>
                    {game.winner ? (
                      <>
                        <dt className="text-muted">Winner</dt>
                        <dd
                          className="text-right capitalize font-medium"
                          style={{ color: "var(--accent)" }}
                        >
                          {game.winner}
                        </dd>
                      </>
                    ) : (
                      <>
                        <dt className="text-muted">To move</dt>
                        <dd
                          className="text-right capitalize"
                          style={{ color: "var(--text-2)" }}
                        >
                          {game.current_player}
                        </dd>
                      </>
                    )}
                    <dt className="text-muted">Updated</dt>
                    <dd className="text-right" style={{ color: "var(--text-2)" }}>
                      {formatDate(game.updated_at)}
                    </dd>
                  </dl>

                  <Link
                    href={`/board?id=${game.id}`}
                    className="btn-secondary inline-flex w-full items-center justify-center gap-1.5 rounded-md py-1.5 px-3 text-sm"
                  >
                    {game.status === "active" ? (
                      <>
                        <AppIcon icon={Play} className="h-3.5 w-3.5" />
                        Resume
                      </>
                    ) : (
                      <>
                        <AppIcon icon={Eye} className="h-3.5 w-3.5" />
                        View
                      </>
                    )}
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Modals */}
        <NewGameModal
          open={showNewGameModal}
          onClose={() => setShowNewGameModal(false)}
          onChoose={handleNewGameChoice}
        />

        <InviteUserModal
          open={inviteComposerOpen}
          onClose={() => {
            setInviteComposerOpen(false);
            setInviteComposerPrefill(undefined);
          }}
          initialUsername={inviteComposerPrefill}
        />

        <InvitesInboxModal
          open={invitesInboxOpen}
          onClose={() => {
            setInvitesInboxOpen(false);
            refreshPendingInvitesCount();
          }}
          onStartGame={(acceptedGameId) => {
            setInvitesInboxOpen(false);
            refreshPendingInvitesCount();
            router.push(`/board?id=${acceptedGameId}&mode=remote`);
          }}
        />

        <BotGameModal
          open={botGameOpen}
          onClose={() => setBotGameOpen(false)}
          onCreated={(gameId, humanColor) => {
            setBotGameOpen(false);
            router.push(`/board?id=${gameId}&you=${humanColor}`);
          }}
        />
    </ChessLayout>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Mailbox, RefreshCw, X } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type InviteRow = {
  id: number;
  from_user_id: string;
  to_user_id: string;
  status: "pending" | "accepted" | "declined" | "expired" | "cancelled";
  time_control_initial_ms: number;
  increment_ms: number;
  game_id?: number | null;
  created_at: string;
  expires_at: string;
  from_profile?: { username?: string | null; full_name?: string | null } | null;
  to_profile?: { username?: string | null; full_name?: string | null } | null;
};

type Tab = "incoming" | "outgoing" | "started";

function formatTimeControl(invite: InviteRow) {
  const minutes = Math.round(invite.time_control_initial_ms / 60000);
  const increment = Math.round(invite.increment_ms / 1000);
  return `${minutes}+${increment}`;
}

function secondsRemaining(expiresAtIso: string): number {
  const ms = new Date(expiresAtIso).getTime() - Date.now();
  return Math.max(0, Math.floor(ms / 1000));
}

export function InvitesInboxModal({
  open,
  onClose,
  onStartGame,
}: {
  open: boolean;
  onClose: () => void;
  onStartGame: (gameId: number) => void;
}) {
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("incoming");
  // Ticking counter so countdown labels refresh once per second.
  const [, setTick] = useState(0);

  const loadInvites = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/invites?direction=all", {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as {
        invites?: InviteRow[];
        error?: string;
      };
      if (!response.ok) {
        setError(data.error || "Failed to load invitations");
        return;
      }
      setInvites(Array.isArray(data.invites) ? data.invites : []);
    } catch {
      setError("Failed to load invitations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    fetch("/api/profile", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { id?: string | number | null }) => {
        if (data?.id) setCurrentUserId(String(data.id));
      })
      .catch(() => {});
    loadInvites();
  }, [open, loadInvites]);

  useEffect(() => {
    if (!open) return;
    const supabase = getSupabaseBrowser();
    const channel = supabase
      .channel("invites-inbox")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invites" },
        () => loadInvites(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, loadInvites]);

  // Ticker for the countdown labels on pending invitations.
  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const respond = async (id: number, action: "accept" | "decline") => {
    const response = await fetch(`/api/invites/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      gameId?: number;
    };
    if (!response.ok) {
      setError(data.error || `Failed to ${action} invitation`);
      return;
    }
    if (action === "accept" && data.gameId) {
      onStartGame(Number(data.gameId));
      onClose();
    } else {
      await loadInvites();
    }
  };

  const cancel = async (id: number) => {
    const response = await fetch(`/api/invites/${id}`, { method: "DELETE" });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(data.error || "Failed to cancel invitation");
      return;
    }
    await loadInvites();
  };

  const incoming = invites.filter(
    (i) =>
      i.status === "pending" &&
      currentUserId !== null &&
      i.to_user_id === currentUserId,
  );
  const outgoing = invites.filter(
    (i) =>
      i.status === "pending" &&
      currentUserId !== null &&
      i.from_user_id === currentUserId,
  );
  const started = invites.filter(
    (i) =>
      i.status === "accepted" &&
      currentUserId !== null &&
      i.from_user_id === currentUserId &&
      Boolean(i.game_id),
  );

  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: "incoming", label: "Incoming", count: incoming.length },
    { id: "outgoing", label: "Outgoing", count: outgoing.length },
    { id: "started", label: "Started", count: started.length },
  ];

  const visible: InviteRow[] =
    tab === "incoming" ? incoming : tab === "outgoing" ? outgoing : started;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "oklch(0 0 0 / 0.55)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="invites-title"
    >
      <div
        className="surface-card w-full max-w-lg overflow-hidden"
        style={{ boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Mailbox className="h-4 w-4" style={{ color: "var(--text-2)" }} />
            <h2
              id="invites-title"
              className="text-base font-semibold tracking-tight"
            >
              Invitations
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={loadInvites}
              disabled={loading}
              className="btn-ghost rounded-md p-1.5"
              aria-label="Refresh"
              title="Refresh"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost rounded-md p-1.5"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div
          className="flex items-center gap-1 px-5 pt-3"
          role="tablist"
          aria-label="Invitations tabs"
        >
          {tabs.map((t) => {
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setTab(t.id)}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  background: isActive ? "var(--accent-soft)" : "transparent",
                  color: isActive ? "var(--accent)" : "var(--text-2)",
                }}
              >
                {t.label}
                {t.count > 0 && (
                  <span
                    className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums"
                    style={{
                      background: isActive
                        ? "var(--accent)"
                        : "var(--surface-2)",
                      color: isActive ? "var(--accent-fg)" : "var(--text-2)",
                    }}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-3">
          {error && (
            <div
              className="mb-3 rounded-md px-3 py-2 text-sm"
              style={{
                background: "var(--danger-soft)",
                color: "var(--text)",
                border: "1px solid color-mix(in oklch, var(--danger) 40%, transparent)",
              }}
            >
              {error}
            </div>
          )}

          {visible.length === 0 ? (
            <div className="px-1 py-10 text-center text-sm text-muted">
              {tab === "incoming" && "No one has challenged you."}
              {tab === "outgoing" && "You haven't sent any pending invitations."}
              {tab === "started" && "Accepted invitations will appear here."}
            </div>
          ) : (
            <ul className="space-y-2">
              {visible.map((invite) => {
                const otherProfile =
                  tab === "incoming" ? invite.from_profile : invite.to_profile;
                const username = otherProfile?.username || "unknown";
                const ttl =
                  tab !== "started" ? secondsRemaining(invite.expires_at) : 0;
                return (
                  <li
                    key={invite.id}
                    className="surface-card-1 flex items-center justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div
                        className="truncate text-sm font-medium"
                        style={{ color: "var(--text)" }}
                      >
                        @{username}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted tabular-nums">
                        <span>{formatTimeControl(invite)}</span>
                        {tab !== "started" && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span
                              style={{
                                color:
                                  ttl <= 10
                                    ? "oklch(0.66 0.16 25)"
                                    : "var(--text-3)",
                              }}
                            >
                              {ttl}s left
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {tab === "incoming" && (
                        <>
                          <button
                            type="button"
                            onClick={() => respond(invite.id, "accept")}
                            className="btn-accent inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs"
                          >
                            <Check className="h-3 w-3" /> Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => respond(invite.id, "decline")}
                            className="btn-secondary inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs"
                          >
                            Decline
                          </button>
                        </>
                      )}
                      {tab === "outgoing" && (
                        <button
                          type="button"
                          onClick={() => cancel(invite.id)}
                          className="btn-secondary inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs"
                        >
                          Cancel
                        </button>
                      )}
                      {tab === "started" && invite.game_id && (
                        <button
                          type="button"
                          onClick={() => {
                            onStartGame(Number(invite.game_id));
                            onClose();
                          }}
                          className="btn-accent inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs"
                        >
                          Open
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

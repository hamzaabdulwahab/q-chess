"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { Alert } from "@/components/Alert";

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

function formatTimeControl(invite: InviteRow) {
  const minutes = Math.round(invite.time_control_initial_ms / 60000);
  const increment = Math.round(invite.increment_ms / 1000);
  return `${minutes}+${increment}`;
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
  const [inviteAcceptedMessage, setInviteAcceptedMessage] = useState<string | null>(null);

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
        setError(data.error || "Failed to load invites");
        return;
      }

      setInvites(Array.isArray(data.invites) ? data.invites : []);
    } catch {
      setError("Failed to load invites");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    fetch("/api/profile", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { id?: string | number | null }) => {
        if (data?.id) {
          setCurrentUserId(String(data.id));
        }
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
        () => {
          loadInvites();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, loadInvites]);

  if (!open) {
    return null;
  }

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
      setError(data.error || `Failed to ${action} invite`);
      return;
    }

    if (action === "accept" && data.gameId) {
      setInviteAcceptedMessage(`Successfully accepted invite! Game #${data.gameId} is starting...`);
      setTimeout(() => {
        onStartGame(Number(data.gameId));
        onClose();
      }, 1000);
    } else {
      await loadInvites();
    }
  };

  const cancel = async (id: number) => {
    const response = await fetch(`/api/invites/${id}`, {
      method: "DELETE",
    });

    const data = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      setError(data.error || "Failed to cancel invite");
      return;
    }

    await loadInvites();
  };

  const incoming: InviteRow[] = invites.filter((invite: InviteRow) => {
    return (
      invite.status === "pending" &&
      currentUserId !== null &&
      invite.to_user_id === currentUserId
    );
  });

  const outgoing: InviteRow[] = invites.filter((invite: InviteRow) => {
    return (
      invite.status === "pending" &&
      currentUserId !== null &&
      invite.from_user_id === currentUserId
    );
  });

  const startedOutgoing: InviteRow[] = invites.filter((invite: InviteRow) => {
    return (
      invite.status === "accepted" &&
      currentUserId !== null &&
      invite.from_user_id === currentUserId &&
      Boolean(invite.game_id)
    );
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-violet-700 bg-gray-900 p-6 text-white shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Invites</h2>
          <button
            onClick={onClose}
            className="rounded-md bg-gray-700 px-3 py-1 hover:bg-gray-600"
          >
            Close
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-md border border-red-700 bg-red-900/40 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="mb-4">
          <button
            onClick={loadInvites}
            disabled={loading}
            className="rounded-md bg-gray-800 px-3 py-1 text-sm hover:bg-gray-700"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-gray-700 p-3">
            <h3 className="mb-2 font-medium">Incoming</h3>
            {incoming.length === 0 && (
              <div className="text-sm text-gray-400">No pending invites.</div>
            )}
            <div className="space-y-2">
              {incoming.map((invite: InviteRow) => (
                <div key={invite.id} className="rounded-md border border-gray-700 p-2">
                  <div className="text-sm">
                    From: {invite.from_profile?.username || "Unknown"}
                  </div>
                  <div className="text-xs text-gray-400">
                    Time: {formatTimeControl(invite)}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => respond(invite.id, "accept")}
                      className="rounded bg-green-700 px-2 py-1 text-xs hover:bg-green-600"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => respond(invite.id, "decline")}
                      className="rounded bg-red-700 px-2 py-1 text-xs hover:bg-red-600"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-gray-700 p-3">
            <h3 className="mb-2 font-medium">Outgoing</h3>
            {outgoing.length === 0 && (
              <div className="text-sm text-gray-400">No pending invites.</div>
            )}
            <div className="space-y-2">
              {outgoing.map((invite: InviteRow) => (
                <div key={invite.id} className="rounded-md border border-gray-700 p-2">
                  <div className="text-sm">
                    To: {invite.to_profile?.username || "Unknown"}
                  </div>
                  <div className="text-xs text-gray-400">
                    Time: {formatTimeControl(invite)}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => cancel(invite.id)}
                      className="rounded bg-gray-700 px-2 py-1 text-xs hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {startedOutgoing.length > 0 && (
              <div className="mt-3 border-t border-gray-700 pt-3">
                <h4 className="mb-2 text-sm font-medium text-gray-200">Started</h4>
                <div className="space-y-2">
                  {startedOutgoing.map((invite: InviteRow) => (
                    <div key={`started-${invite.id}`} className="rounded-md border border-green-700/50 p-2">
                      <div className="text-sm">
                        Vs: {invite.to_profile?.username || "Unknown"}
                      </div>
                      <div className="text-xs text-gray-400">
                        Time: {formatTimeControl(invite)}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => {
                            if (invite.game_id) {
                              onStartGame(Number(invite.game_id));
                              onClose();
                            }
                          }}
                          className="rounded bg-green-700 px-2 py-1 text-xs hover:bg-green-600"
                        >
                          Open Game
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

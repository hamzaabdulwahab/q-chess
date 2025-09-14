"use client";
import { useEffect, useMemo, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

export function InviteDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingInvite, setPendingInvite] = useState<{
    id: string;
    expires_at: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const [now, setNow] = useState<number>(Date.now());
  // Smooth ticking countdown (UI-only); server validation remains authoritative
  useEffect(() => {
    if (!pendingInvite) return;
    const iv = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(iv);
  }, [pendingInvite]);
  const secondsLeft = useMemo(() => {
    if (!pendingInvite) return 0;
    const ms = new Date(pendingInvite.expires_at).getTime() - now;
    return Math.max(0, Math.ceil(ms / 1000));
  }, [pendingInvite, now]);

  useEffect(() => {
    if (!open) {
      setUsername("");
      setError(null);
      setPendingInvite(null);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!pendingInvite) return;
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`/api/invites/${pendingInvite.id}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) {
          if (res.status === 410 || json.error === "Invite expired") {
            setError("Invite expired");
            setPendingInvite(null);
          }
          return;
        }
        const inv = json.invite as {
          expires_at: string;
          status: string;
          room_id: string;
        };
        if (new Date(inv.expires_at).getTime() < Date.now()) {
          setError("Invite expired");
          setPendingInvite(null);
          return;
        }
        if (inv.status === "accepted") {
          router.push(`/online?room=${inv.room_id}`);
        } else if (inv.status === "declined") {
          setError("Invite declined");
          setPendingInvite(null);
        }
      } catch {}
    }, 2500);
    // Realtime subscription for the same invite id
    const supabase = getSupabaseBrowser();
    type InviteRow = {
      id: string;
      status: "pending" | "accepted" | "declined";
      room_id: string | null;
      expires_at: string;
    };
    const handler = (payload: RealtimePostgresChangesPayload<InviteRow>) => {
      const inv = (payload.new ?? payload.old) as InviteRow | null;
      if (!inv) return;
      if (new Date(inv.expires_at).getTime() < Date.now()) {
        setError("Invite expired");
        setPendingInvite(null);
        return;
      }
      if (inv.status === "accepted") {
        router.push(`/online?room=${inv.room_id}`);
      } else if (inv.status === "declined") {
        setError("Invite declined");
        setPendingInvite(null);
      }
    };

    const channel = supabase
      .channel(`invite-${pendingInvite.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "invites",
          filter: `id=eq.${pendingInvite.id}`,
        },
        handler
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "invites",
          filter: `id=eq.${pendingInvite.id}`,
        },
        handler
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "invites",
          filter: `id=eq.${pendingInvite.id}`,
        },
        handler
      )
      .subscribe();

    return () => {
      clearInterval(iv);
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [pendingInvite, router]);

  // submit logic handled inline on button click

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60">
      <div className="w-[90%] max-w-md rounded-xl border border-violet-700 bg-gray-900 text-white shadow-2xl p-6">
        {!pendingInvite ? (
          <>
            <div className="text-lg font-semibold mb-2">Invite by username</div>
            <div className="text-sm text-accent mb-4">
              Enter a friend’s username to send a match request.
            </div>
            {error && <div className="text-red-300 text-sm mb-2">{error}</div>}
            <input
              autoFocus
              value={username}
              onChange={(e) => {
                // Keep display with optional leading @; trim spaces
                const v = e.target.value.replace(/\s+/g, "");
                setUsername(v);
              }}
              placeholder="@username"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm mb-4 outline-none focus:border-accent"
            />
            <div className="flex justify-end gap-2">
              <button
                className="px-3 py-2 text-sm rounded bg-gray-800 border border-gray-700 hover:bg-gray-700"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                disabled={submitting || !username.trim()}
                className="px-3 py-2 text-sm rounded bg-violet-600 hover:bg-violet-500 disabled:opacity-60"
                onClick={() => {
                  const u = username.startsWith("@")
                    ? username.slice(1)
                    : username;
                  setUsername(u ? `@${u}` : "");
                  // send without @
                  (async () => {
                    setSubmitting(true);
                    setError(null);
                    try {
                      const res = await fetch("/api/invites", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ username: u }),
                      });
                      const json = await res.json();
                      if (!res.ok)
                        throw new Error(
                          json.error || "Failed to create invite"
                        );
                      setPendingInvite({
                        id: json.invite.id,
                        expires_at: json.invite.expires_at,
                      });
                    } catch (e: unknown) {
                      const err = e as Error;
                      setError(err.message || "Failed to create invite");
                    } finally {
                      setSubmitting(false);
                    }
                  })();
                }}
              >
                {submitting ? "Sending…" : "Send invite"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-lg font-semibold mb-2">
              Waiting for acceptance…
            </div>
            {error && <div className="text-red-300 text-sm mb-2">{error}</div>}
            <div className="text-sm text-accent mb-1">
              We’ll start as soon as your friend accepts.
            </div>
            <div className="text-sm text-accent mb-4">
              Expires in: {Math.floor(secondsLeft / 60)}:
              {("0" + (secondsLeft % 60)).slice(-2)}
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="px-3 py-2 text-sm rounded bg-gray-800 border border-gray-700 hover:bg-gray-700"
                onClick={() => {
                  setPendingInvite(null);
                  setError(null);
                }}
              >
                Back
              </button>
              <button
                className="px-3 py-2 text-sm rounded bg-red-600 hover:bg-red-500"
                onClick={async () => {
                  if (!pendingInvite) return;
                  try {
                    await fetch(`/api/invites/${pendingInvite.id}`, {
                      method: "DELETE",
                    });
                  } catch {}
                  setPendingInvite(null);
                  setError(null);
                }}
              >
                Cancel invite
              </button>
              <button
                className="px-3 py-2 text-sm rounded bg-violet-600 hover:bg-violet-500"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

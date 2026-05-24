"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

type Preset = "blitz" | "rapid" | "long" | "custom";

const PRESETS: Array<{
  id: Preset;
  label: string;
  minutes: number;
  increment: number;
}> = [
  { id: "blitz", label: "Blitz", minutes: 3, increment: 2 },
  { id: "rapid", label: "Rapid", minutes: 10, increment: 0 },
  { id: "long", label: "Classical", minutes: 30, increment: 0 },
  { id: "custom", label: "Custom", minutes: 0, increment: 0 },
];

export function InviteUserModal({
  open,
  onClose,
  initialUsername,
}: {
  open: boolean;
  onClose: () => void;
  initialUsername?: string;
}) {
  const [username, setUsername] = useState(initialUsername ?? "");
  const [preset, setPreset] = useState<Preset>("rapid");
  const [minutes, setMinutes] = useState(10);
  const [increment, setIncrement] = useState(0);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && initialUsername) setUsername(initialUsername);
  }, [open, initialUsername]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const effective = useMemo(() => {
    const found = PRESETS.find((p) => p.id === preset);
    if (preset === "custom" || !found) {
      return {
        minutes: Math.min(30, Math.max(1, Math.floor(minutes))),
        increment: Math.min(30, Math.max(0, Math.floor(increment))),
      };
    }
    return { minutes: found.minutes, increment: found.increment };
  }, [preset, minutes, increment]);

  if (!open) return null;

  const reset = () => {
    setUsername("");
    setPreset("rapid");
    setMinutes(10);
    setIncrement(0);
    setMessage(null);
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const sendInvite = async () => {
    try {
      setSending(true);
      setError(null);
      setMessage(null);

      const response = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          timeControlMinutes: effective.minutes,
          incrementSeconds: effective.increment,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || "Failed to send invitation");
        return;
      }

      setMessage("Invitation sent.");
      setUsername("");
    } catch {
      setError("Failed to send invitation");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "oklch(0 0 0 / 0.55)" }}
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-title"
    >
      <div
        className="surface-card w-full max-w-md"
        style={{ boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 id="invite-title" className="text-base font-semibold tracking-tight">
            Challenge a player
          </h2>
          <button
            type="button"
            onClick={close}
            className="btn-ghost rounded-md p-1.5"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="px-5 py-5 space-y-5">
          <div>
            <label
              htmlFor="invite-username"
              className="mb-1.5 block text-xs font-medium"
              style={{ color: "var(--text-2)" }}
            >
              Username
            </label>
            <input
              id="invite-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="e.g. hamza123"
              className="input"
              autoComplete="off"
              autoFocus
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span
                className="text-xs font-medium"
                style={{ color: "var(--text-2)" }}
              >
                Time control
              </span>
              <span className="text-xs tabular-nums text-muted">
                {effective.minutes}+{effective.increment}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {PRESETS.map((p) => {
                const isActive = preset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPreset(p.id)}
                    className="rounded-md px-2 py-2 text-xs font-medium transition-colors"
                    style={{
                      background: isActive
                        ? "var(--accent-soft)"
                        : "var(--surface-1)",
                      color: isActive ? "var(--accent)" : "var(--text-2)",
                      border: `1px solid ${
                        isActive ? "var(--accent)" : "var(--border-strong)"
                      }`,
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {preset === "custom" && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="invite-minutes"
                    className="mb-1 block text-[11px]"
                    style={{ color: "var(--text-3)" }}
                  >
                    Minutes (1 to 30)
                  </label>
                  <input
                    id="invite-minutes"
                    type="number"
                    min={1}
                    max={30}
                    value={minutes}
                    onChange={(event) =>
                      setMinutes(Number(event.target.value))
                    }
                    className="input"
                  />
                </div>
                <div>
                  <label
                    htmlFor="invite-increment"
                    className="mb-1 block text-[11px]"
                    style={{ color: "var(--text-3)" }}
                  >
                    Increment seconds (0 to 30)
                  </label>
                  <input
                    id="invite-increment"
                    type="number"
                    min={0}
                    max={30}
                    value={increment}
                    onChange={(event) =>
                      setIncrement(Number(event.target.value))
                    }
                    className="input"
                  />
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-muted">
            Invitations expire in 60 seconds. Up to 5 pending at a time.
          </p>

          {message && (
            <div
              className="rounded-md px-3 py-2 text-sm"
              style={{
                background: "var(--success-soft)",
                color: "var(--text)",
                border: "1px solid color-mix(in oklch, var(--success) 35%, transparent)",
              }}
            >
              {message}
            </div>
          )}
          {error && (
            <div
              className="rounded-md px-3 py-2 text-sm"
              style={{
                background: "var(--danger-soft)",
                color: "var(--text)",
                border: "1px solid color-mix(in oklch, var(--danger) 40%, transparent)",
              }}
            >
              {error}
            </div>
          )}
        </div>

        <footer className="flex justify-end gap-2 px-5 py-4 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={close}
            disabled={sending}
            className="btn-secondary rounded-md px-3 py-1.5 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={sendInvite}
            disabled={sending || !username.trim()}
            className="btn-accent rounded-md px-4 py-1.5 text-sm"
          >
            {sending ? "Sending…" : "Send invitation"}
          </button>
        </footer>
      </div>
    </div>
  );
}

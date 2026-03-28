"use client";

import { useMemo, useState } from "react";

type Preset = "blitz" | "rapid" | "long" | "custom";

export function InviteUserModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [username, setUsername] = useState("");
  const [preset, setPreset] = useState<Preset>("rapid");
  const [minutes, setMinutes] = useState(10);
  const [increment, setIncrement] = useState(0);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const effectiveTime = useMemo(() => {
    if (preset === "blitz") return { minutes: 3, increment: 2 };
    if (preset === "rapid") return { minutes: 10, increment: 0 };
    if (preset === "long") return { minutes: 30, increment: 0 };
    return {
      minutes: Math.min(30, Math.max(1, Math.floor(minutes))),
      increment: Math.min(30, Math.max(0, Math.floor(increment))),
    };
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
          timeControlMinutes: effectiveTime.minutes,
          incrementSeconds: effectiveTime.increment,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || "Failed to send invite");
        return;
      }

      setMessage("Invite sent successfully.");
      setUsername("");
    } catch {
      setError("Failed to send invite");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-violet-700 bg-gray-900 text-white p-6 shadow-2xl">
        <h2 className="text-lg font-semibold mb-1">Invite by username</h2>
        <p className="text-sm text-gray-300 mb-4">
          Send a private challenge to another player.
        </p>

        <label className="block text-sm mb-1">Username</label>
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="e.g. hamza123"
          className="w-full rounded-md bg-gray-800 border border-gray-700 px-3 py-2 mb-4"
        />

        <label className="block text-sm mb-1">Time control</label>
        <select
          value={preset}
          onChange={(event) => setPreset(event.target.value as Preset)}
          className="w-full rounded-md bg-gray-800 border border-gray-700 px-3 py-2 mb-3"
        >
          <option value="blitz">Blitz 3+2</option>
          <option value="rapid">Rapid 10+0</option>
          <option value="long">Rapid 30+0</option>
          <option value="custom">Custom</option>
        </select>

        {preset === "custom" && (
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-300 mb-1">Minutes</label>
              <input
                type="number"
                min={1}
                max={30}
                value={minutes}
                onChange={(event) => setMinutes(Number(event.target.value))}
                className="w-full rounded-md bg-gray-800 border border-gray-700 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-300 mb-1">
                Increment (sec)
              </label>
              <input
                type="number"
                min={0}
                max={30}
                value={increment}
                onChange={(event) => setIncrement(Number(event.target.value))}
                className="w-full rounded-md bg-gray-800 border border-gray-700 px-3 py-2"
              />
            </div>
          </div>
        )}

        <div className="text-xs text-gray-400 mb-3">
          Invite expires automatically in 15 minutes.
        </div>

        {message && (
          <div className="mb-3 rounded-md border border-green-700 bg-green-900/40 px-3 py-2 text-sm text-green-200">
            {message}
          </div>
        )}
        {error && (
          <div className="mb-3 rounded-md border border-red-700 bg-red-900/40 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={close}
            className="px-4 py-2 rounded-md bg-gray-700 hover:bg-gray-600"
            disabled={sending}
          >
            Close
          </button>
          <button
            onClick={sendInvite}
            className="px-4 py-2 rounded-md btn-accent text-black disabled:opacity-60"
            disabled={sending || !username.trim()}
          >
            {sending ? "Sending..." : "Send Invite"}
          </button>
        </div>
      </div>
    </div>
  );
}

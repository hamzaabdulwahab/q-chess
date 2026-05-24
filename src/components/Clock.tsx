"use client";

import { useEffect, useState } from "react";

interface ClockProps {
  // Server-returned baseline. ms remaining on this player's clock as of
  // `lastSyncAt`. If null/undefined the game is untimed and the clock hides.
  timeLeftMs: number | null | undefined;
  // ISO timestamp of the last server-side time deduction (games.last_move_at).
  // Elapsed since this moment is subtracted from `timeLeftMs` while ticking.
  lastSyncAt: string | null | undefined;
  // Whether this player is the side to move right now (clock should tick).
  isActive: boolean;
  // When true the entire game is over; freeze the displayed value.
  isFrozen?: boolean;
}

function format(ms: number): string {
  const clamped = Math.max(0, ms);
  const totalSeconds = Math.floor(clamped / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (clamped < 10_000) {
    const tenths = Math.floor((clamped % 1000) / 100);
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${tenths}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function Clock({
  timeLeftMs,
  lastSyncAt,
  isActive,
  isFrozen,
}: ClockProps) {
  const [displayMs, setDisplayMs] = useState<number>(timeLeftMs ?? 0);

  useEffect(() => {
    if (timeLeftMs == null) return;

    const baseline = timeLeftMs;
    const syncEpoch = lastSyncAt ? new Date(lastSyncAt).getTime() : Date.now();

    const compute = () => {
      if (!isActive || isFrozen) {
        setDisplayMs(baseline);
        return;
      }
      const elapsed = Date.now() - syncEpoch;
      setDisplayMs(Math.max(0, baseline - elapsed));
    };

    compute();
    if (!isActive || isFrozen) return;

    const id = window.setInterval(compute, 100);
    return () => window.clearInterval(id);
  }, [timeLeftMs, lastSyncAt, isActive, isFrozen]);

  if (timeLeftMs == null) return null;

  const isLow = displayMs < 30_000 && isActive && !isFrozen;
  const isCritical = displayMs < 10_000 && isActive && !isFrozen;

  return (
    <div
      className={[
        "font-mono text-2xl font-semibold tabular-nums px-3 py-1 rounded-md transition-colors",
        isActive && !isFrozen
          ? "bg-gray-900 text-white border border-violet-500/60"
          : "bg-gray-800/70 text-gray-300 border border-gray-700",
        isCritical ? "text-red-400 border-red-500/70" : "",
        !isCritical && isLow ? "text-amber-300" : "",
      ].join(" ")}
      aria-label={isActive ? "Active clock" : "Opponent clock"}
    >
      {format(displayMs)}
    </div>
  );
}

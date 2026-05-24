"use client";

import { useEffect, useState } from "react";

interface FloatingClocksProps {
  whiteTimeLeftMs: number | null;
  blackTimeLeftMs: number | null;
  // ISO timestamp of the last server-side time deduction.
  lastSyncAt: string | null;
  currentTurn: "white" | "black";
  // The local player's color (null for local hot-seat games).
  myColor: "white" | "black" | null;
  opponentUsername?: string | null;
  isFrozen: boolean;
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

function ClockRow({
  label,
  timeLeftMs,
  isActive,
  isFrozen,
  syncEpoch,
}: {
  label: string;
  timeLeftMs: number | null;
  isActive: boolean;
  isFrozen: boolean;
  syncEpoch: number;
}) {
  const [displayMs, setDisplayMs] = useState<number>(timeLeftMs ?? 0);

  useEffect(() => {
    if (timeLeftMs == null) return;
    const baseline = timeLeftMs;
    const compute = () => {
      if (!isActive || isFrozen) {
        setDisplayMs(baseline);
        return;
      }
      setDisplayMs(Math.max(0, baseline - (Date.now() - syncEpoch)));
    };
    compute();
    if (!isActive || isFrozen) return;
    const id = window.setInterval(compute, 100);
    return () => window.clearInterval(id);
  }, [timeLeftMs, syncEpoch, isActive, isFrozen]);

  if (timeLeftMs == null) return null;

  const live = isActive && !isFrozen;
  const isLow = live && displayMs < 30_000;
  const isCritical = live && displayMs < 10_000;

  return (
    <div
      className="flex items-center justify-between gap-3 px-3 py-2.5 transition-colors"
      style={{
        background: live ? "var(--accent-soft)" : "transparent",
      }}
    >
      <span
        className="truncate text-xs font-medium"
        style={{
          color: live ? "var(--text-2)" : "var(--text-3)",
          maxWidth: "9ch",
        }}
      >
        {label}
      </span>
      <span
        className="font-mono text-lg tabular-nums"
        style={{
          color: isCritical
            ? "oklch(0.7 0.16 25)"
            : isLow
              ? "var(--warning)"
              : live
                ? "var(--text)"
                : "var(--text-3)",
          fontVariantNumeric: "tabular-nums",
          fontWeight: 600,
        }}
      >
        {format(displayMs)}
      </span>
    </div>
  );
}

export function FloatingClocks({
  whiteTimeLeftMs,
  blackTimeLeftMs,
  lastSyncAt,
  currentTurn,
  myColor,
  opponentUsername,
  isFrozen,
}: FloatingClocksProps) {
  if (whiteTimeLeftMs == null && blackTimeLeftMs == null) return null;

  const syncEpoch = lastSyncAt ? new Date(lastSyncAt).getTime() : Date.now();

  // Opponent on top, you on bottom. For local hot-seat: black on top.
  const topColor: "white" | "black" =
    myColor === "white" ? "black" : myColor === "black" ? "white" : "black";
  const bottomColor: "white" | "black" =
    topColor === "white" ? "black" : "white";

  const labelFor = (color: "white" | "black"): string => {
    if (myColor === null) return color === "white" ? "White" : "Black";
    if (color === myColor) return "You";
    return opponentUsername ? `@${opponentUsername}` : "Opponent";
  };

  const timeFor = (color: "white" | "black") =>
    color === "white" ? whiteTimeLeftMs : blackTimeLeftMs;

  return (
    <div
      className="fixed top-20 right-4 z-30 w-44 overflow-hidden rounded-md"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow)",
      }}
    >
      <ClockRow
        label={labelFor(topColor)}
        timeLeftMs={timeFor(topColor)}
        isActive={currentTurn === topColor}
        isFrozen={isFrozen}
        syncEpoch={syncEpoch}
      />
      <div
        aria-hidden="true"
        style={{ height: 1, background: "var(--border)" }}
      />
      <ClockRow
        label={labelFor(bottomColor)}
        timeLeftMs={timeFor(bottomColor)}
        isActive={currentTurn === bottomColor}
        isFrozen={isFrozen}
        syncEpoch={syncEpoch}
      />
    </div>
  );
}

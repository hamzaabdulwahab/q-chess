"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type PieceType = "p" | "n" | "b" | "r" | "q" | "k";
const PIECE_VALUES: Record<PieceType, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};
const PIECE_ORDER: PieceType[] = ["q", "r", "b", "n", "p"];
const MAX_DISPLAYED_CAPTURES = 8;
function isPieceType(s: string): s is PieceType {
  return (
    s === "p" || s === "n" || s === "b" || s === "r" || s === "q" || s === "k"
  );
}

export interface PlayerCardProps {
  // Identity
  username: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
  color: "white" | "black";
  isYou: boolean;
  // Clock state — null for untimed games.
  timeLeftMs: number | null;
  lastSyncAt: string | null;
  // Active = this player is to move and the game is live.
  isActive: boolean;
  isClockFrozen: boolean;
  // Pieces this player has captured (opponent-color piece types).
  capturedPieces: string[];
  // Pieces the OPPONENT has captured — needed to compute material delta.
  opponentCapturedPieces: string[];
  showCapturedPieces?: boolean;
}

function formatClock(ms: number): string {
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

function pieceImage(piece: PieceType, capturedFromColor: "white" | "black") {
  const names: Record<PieceType, string> = {
    p: "pawn",
    n: "knight",
    b: "bishop",
    r: "rook",
    q: "queen",
    k: "king",
  };
  return `/pieces/${capturedFromColor}-${names[piece]}.png`;
}

function sumValue(pieces: string[]): number {
  return pieces.reduce(
    (acc, p) => (isPieceType(p) ? acc + PIECE_VALUES[p] : acc),
    0,
  );
}

export function PlayerCard({
  username,
  avatarUrl,
  color,
  isYou,
  timeLeftMs,
  lastSyncAt,
  isActive,
  isClockFrozen,
  capturedPieces,
  opponentCapturedPieces,
  showCapturedPieces = true,
}: PlayerCardProps) {
  const [displayMs, setDisplayMs] = useState<number>(timeLeftMs ?? 0);

  useEffect(() => {
    if (timeLeftMs == null) return;
    const baseline = timeLeftMs;
    const epoch = lastSyncAt ? new Date(lastSyncAt).getTime() : Date.now();
    const compute = () => {
      if (!isActive || isClockFrozen) {
        setDisplayMs(baseline);
        return;
      }
      setDisplayMs(Math.max(0, baseline - (Date.now() - epoch)));
    };
    compute();
    if (!isActive || isClockFrozen) return;
    const id = window.setInterval(compute, 100);
    return () => window.clearInterval(id);
  }, [timeLeftMs, lastSyncAt, isActive, isClockFrozen]);

  const live = isActive && !isClockFrozen;
  const isLow = live && displayMs < 30_000;
  const isCritical = live && displayMs < 10_000;

  // Material advantage: positive = this player is up material.
  const myValue = sumValue(capturedPieces);
  const oppValue = sumValue(opponentCapturedPieces);
  const advantage = myValue - oppValue;

  // Group captured pieces for display.
  const grouped = new Map<PieceType, number>();
  for (const raw of capturedPieces) {
    if (!isPieceType(raw)) continue;
    grouped.set(raw, (grouped.get(raw) ?? 0) + 1);
  }
  const orderedCaptures = PIECE_ORDER.flatMap((piece) => {
    const count = grouped.get(piece) ?? 0;
    return Array.from({ length: count }, (_, i) => ({
      piece,
      key: `${piece}-${i}`,
    }));
  });

  const label = username ?? (color === "white" ? "White" : "Black");
  const capturedFromColor: "white" | "black" =
    color === "white" ? "black" : "white";

  return (
    <div
      className="flex items-center gap-2.5 px-1.5 py-1.5 transition-colors"
      style={{
        background: "transparent",
      }}
    >
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt=""
          width={28}
          height={28}
          unoptimized
          className="h-7 w-7 shrink-0 rounded-full object-cover"
          style={{ border: "1px solid var(--border-strong)" }}
        />
      ) : (
        <div
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold"
          style={{
            background: "var(--avatar-fallback)",
            border:
              "1px solid color-mix(in oklch, var(--avatar-fallback) 78%, white 16%)",
            color: "white",
          }}
        >
          {label.slice(0, 1).toUpperCase()}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className="truncate text-sm font-semibold leading-tight"
            style={{ color: "var(--text)" }}
          >
            {username ? username : label}
          </span>
          {isYou && (
            <span
              className="rounded px-1 text-[9px] font-semibold uppercase tracking-wider"
              style={{
                color: "var(--text-3)",
                border: "1px solid var(--border-strong)",
              }}
            >
              you
            </span>
          )}
        </div>
        {showCapturedPieces && (orderedCaptures.length > 0 || advantage > 0) && (
          <div className="mt-0.5 flex max-w-full items-center gap-1 overflow-hidden">
            <div className="flex min-w-0 shrink items-center -space-x-1">
              {orderedCaptures.slice(0, MAX_DISPLAYED_CAPTURES).map(({ piece, key }) => (
                <Image
                  key={key}
                  src={pieceImage(piece, capturedFromColor)}
                  alt=""
                  width={12}
                  height={12}
                  unoptimized
                  className="shrink-0 opacity-75"
                />
              ))}
            </div>
            {orderedCaptures.length > MAX_DISPLAYED_CAPTURES && (
              <span
                className="shrink-0 text-[10px] tabular-nums"
                style={{ color: "var(--text-3)" }}
              >
                +{orderedCaptures.length - MAX_DISPLAYED_CAPTURES}
              </span>
            )}
            {advantage > 0 && (
              <span
                className="shrink-0 text-[10px] font-semibold tabular-nums"
                style={{ color: "var(--text-3)" }}
              >
                +{advantage}
              </span>
            )}
          </div>
        )}
      </div>

      {timeLeftMs != null && (
        <div
          className="shrink-0 rounded-md px-3 py-1.5 font-mono text-2xl tabular-nums"
          style={{
            background: live ? "var(--bg)" : "var(--surface-1)",
            color: isCritical
              ? "var(--danger)"
              : isLow
                ? "var(--warning)"
                : live
                  ? "var(--text)"
                  : "var(--text-3)",
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            minWidth: "5.5ch",
            textAlign: "right",
            letterSpacing: "0.02em",
            border: `1px solid ${live ? "var(--text)" : "var(--border)"}`,
          }}
          aria-live={live ? "polite" : "off"}
        >
          {formatClock(displayMs)}
        </div>
      )}
    </div>
  );
}

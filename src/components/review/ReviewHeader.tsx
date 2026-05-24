"use client";

import { useEffect, useState } from "react";
import type { GameAnalysisSummary } from "@/lib/review/types";

interface ReviewHeaderProps {
  summary: GameAnalysisSummary;
  whiteName: string;
  blackName: string;
}

/**
 * Top of the review dashboard: two animated accuracy arcs and the
 * estimated performance Elo for each side. Pure SVG (no chart lib).
 */
export function ReviewHeader({
  summary,
  whiteName,
  blackName,
}: ReviewHeaderProps) {
  return (
    <div
      className="grid grid-cols-2 gap-3 p-3"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <PlayerAccuracy
        label="White"
        name={whiteName}
        accuracy={summary.accuracyWhite}
        perfElo={summary.perfEloWhite}
      />
      <PlayerAccuracy
        label="Black"
        name={blackName}
        accuracy={summary.accuracyBlack}
        perfElo={summary.perfEloBlack}
      />
    </div>
  );
}

function PlayerAccuracy({
  label,
  name,
  accuracy,
  perfElo,
}: {
  label: string;
  name: string;
  accuracy: number;
  perfElo: number;
}) {
  // Reveal the arc once mounted: start at 0%, animate to the real
  // value. Reuses the global `--ease` curve.
  const [revealed, setRevealed] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => setRevealed(accuracy), 60);
    return () => window.clearTimeout(t);
  }, [accuracy]);

  const accent = accuracyColor(accuracy);

  return (
    <div
      className="surface-card flex flex-col items-center gap-2 p-3"
      style={{ background: "var(--surface)" }}
    >
      <div
        className="text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-3)" }}
      >
        {label}
      </div>
      <AccuracyArc value={revealed} color={accent} />
      <div className="text-center">
        <div
          className="truncate text-sm font-semibold"
          style={{ color: "var(--text)" }}
        >
          {name}
        </div>
        <div
          className="mt-0.5 text-[11px] tabular-nums"
          style={{ color: "var(--text-3)" }}
        >
          Perf <span style={{ color: "var(--text-2)" }}>{perfElo}</span>
        </div>
      </div>
    </div>
  );
}

const SIZE = 88;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

function AccuracyArc({ value, color }: { value: number; color: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  const offset = CIRC * (1 - clamped / 100);
  return (
    <div className="relative" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke="var(--border)"
          strokeWidth={STROKE}
          fill="none"
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={color}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          style={{
            transition:
              "stroke-dashoffset 800ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-xl font-bold tabular-nums leading-none"
          style={{ color: "var(--text)" }}
        >
          {clamped.toFixed(1)}
        </span>
        <span
          className="mt-0.5 text-[9px] uppercase tracking-wider"
          style={{ color: "var(--text-3)" }}
        >
          accuracy
        </span>
      </div>
    </div>
  );
}

function accuracyColor(acc: number): string {
  if (acc >= 90) return "var(--cls-excellent)";
  if (acc >= 80) return "var(--cls-good)";
  if (acc >= 65) return "var(--cls-inaccuracy)";
  if (acc >= 50) return "var(--cls-mistake)";
  return "var(--cls-blunder)";
}

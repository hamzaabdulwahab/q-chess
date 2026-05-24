"use client";

import { Loader2 } from "lucide-react";
import type { AnalysisProgress } from "@/lib/review/types";

interface AnalyzeProgressProps {
  progress: AnalysisProgress | null;
  /** Shown when the analyze request hasn't reported a probe yet. */
  startingHint?: string;
}

/**
 * Centered card shown while the analyze endpoint is running.
 * The progress bar is driven by polling `GET /analysis?probe=true`.
 */
export function AnalyzeProgress({
  progress,
  startingHint,
}: AnalyzeProgressProps) {
  const total = progress?.totalPlies ?? 0;
  const done = progress?.analyzedPlies ?? 0;
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;

  return (
    <div className="flex h-full w-full items-center justify-center px-6 py-10">
      <div
        className="surface-card flex w-full max-w-md flex-col gap-3 p-5"
        style={{ background: "var(--surface)" }}
      >
        <div className="flex items-center gap-2">
          <Loader2
            className="h-4 w-4 animate-spin"
            style={{ color: "var(--text-2)" }}
          />
          <span
            className="text-sm font-semibold"
            style={{ color: "var(--text)" }}
          >
            Analyzing your game
          </span>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-3)" }}>
          Stockfish is evaluating every position. This usually takes about
          a second per half-move.
        </p>

        <div
          className="h-1.5 w-full overflow-hidden rounded-full"
          style={{ background: "var(--surface-1)" }}
        >
          <div
            className="h-full"
            style={{
              width: `${pct}%`,
              background: "var(--text)",
              transition: "width 240ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          />
        </div>

        <div
          className="flex items-center justify-between text-[11px] tabular-nums"
          style={{ color: "var(--text-3)" }}
        >
          <span>
            {total > 0
              ? `${done} / ${total} plies`
              : (startingHint ?? "Loading game…")}
          </span>
          <span>{pct.toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}

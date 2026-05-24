"use client";

import type { ReviewedMove } from "@/lib/review/types";
import { CLASS_META } from "./ClassMeta";

interface CoachPanelProps {
  move: ReviewedMove | null;
}

/**
 * Single-paragraph commentary for the currently selected move plus a
 * classification badge (icon + label + tag).
 */
export function CoachPanel({ move }: CoachPanelProps) {
  if (!move) {
    return (
      <div
        className="px-3 py-4 text-center text-xs"
        style={{ color: "var(--text-3)" }}
      >
        Step through the game to see commentary.
      </div>
    );
  }

  const meta = CLASS_META[move.classification];
  const Icon = meta.icon;
  const evalStr = formatEval(move.evalAfter.cp, move.evalAfter.mate);

  return (
    <div
      className="px-3 py-3"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <header className="mb-2 flex items-center justify-between">
        <span
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-3)" }}
        >
          Coach
        </span>
        <span
          className="text-[10px] tabular-nums"
          style={{ color: "var(--text-3)" }}
        >
          eval {evalStr}
        </span>
      </header>

      <div className="flex items-start gap-2.5">
        <span
          className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md"
          style={{
            background: "var(--surface-1)",
            border: `1px solid ${meta.cssVar}`,
          }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color: meta.cssVar }} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span
              className="text-sm font-semibold"
              style={{ color: meta.cssVar }}
            >
              {meta.label}
            </span>
            {meta.tag && (
              <span
                className="font-mono text-xs"
                style={{ color: "var(--text-3)" }}
              >
                {meta.tag}
              </span>
            )}
            <span
              className="ml-auto text-xs tabular-nums"
              style={{ color: "var(--text-3)" }}
            >
              {move.player === "white" ? "White" : "Black"} · move {Math.ceil(move.ply / 2)}
            </span>
          </div>
          <p
            className="mt-1 text-xs leading-relaxed"
            style={{ color: "var(--text-2)" }}
          >
            {move.coachComment}
          </p>
        </div>
      </div>
    </div>
  );
}

function formatEval(cp: number | null, mate: number | null): string {
  if (mate != null) return `M${mate > 0 ? mate : -mate}`;
  if (cp == null) return "0.0";
  const signed = (cp / 100).toFixed(1);
  return cp > 0 ? `+${signed}` : signed;
}

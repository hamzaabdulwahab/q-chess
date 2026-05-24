"use client";

import { useMemo } from "react";
import type { ReviewedMove } from "@/lib/review/types";

interface EvalGraphProps {
  moves: ReviewedMove[];
  activePly: number;          // 1-indexed
  onJumpTo: (ply: number) => void;
}

// View-port for the SVG. The graph stretches to its container width,
// keeping a fixed aspect ratio via `preserveAspectRatio="none"`.
const VB_W = 600;
const VB_H = 120;
const CP_CLAMP = 1000;        // ±10 pawns visual ceiling
const MID = VB_H / 2;

/**
 * Horizontal eval-vs-ply chart with a clickable hit-strip per ply.
 * Pure SVG so we have no chart-library dependency.
 */
export function EvalGraph({ moves, activePly, onJumpTo }: EvalGraphProps) {
  const { areaD, lineD, points, plyAtX } = useMemo(() => {
    const n = moves.length;
    if (n === 0) {
      return {
        areaD: "",
        lineD: "",
        points: [] as Array<{ x: number; y: number; ply: number }>,
        plyAtX: (_xPct: number) => {
          void _xPct;
          return 1;
        },
      };
    }
    const stepX = VB_W / Math.max(1, n);
    const pts = moves.map((m, i) => {
      const cp = evalToCp(m);
      const clamped = Math.max(-CP_CLAMP, Math.min(CP_CLAMP, cp));
      const y = MID - (clamped / CP_CLAMP) * MID;
      const x = stepX * (i + 0.5);
      return { x, y, ply: m.ply };
    });

    const line = pts
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(" ");
    const area =
      `M${pts[0].x.toFixed(2)} ${MID} ` +
      pts.map((p) => `L${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ") +
      ` L${pts[pts.length - 1].x.toFixed(2)} ${MID} Z`;

    return {
      areaD: area,
      lineD: line,
      points: pts,
      plyAtX: (xPct: number) => {
        const idx = Math.min(n - 1, Math.max(0, Math.floor((xPct / 100) * n)));
        return pts[idx].ply;
      },
    };
  }, [moves]);

  if (moves.length === 0) return null;

  const activePoint = points.find((p) => p.ply === activePly);

  return (
    <div
      className="px-3 py-2"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <header className="mb-1 flex items-center justify-between">
        <span
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-3)" }}
        >
          Evaluation
        </span>
        <span
          className="text-[10px] tabular-nums"
          style={{ color: "var(--text-3)" }}
        >
          {moves.length} plies
        </span>
      </header>
      <div
        className="relative w-full overflow-hidden rounded-md"
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--border)",
        }}
      >
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="none"
          className="block h-32 w-full"
        >
          {/* Mid-line (eval = 0) */}
          <line
            x1={0}
            x2={VB_W}
            y1={MID}
            y2={MID}
            stroke="var(--border-strong)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          {/* Area fill */}
          <path
            d={areaD}
            fill="var(--accent-soft)"
            style={{
              transition: "d 300ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          />
          {/* Line */}
          <path
            d={lineD}
            fill="none"
            stroke="var(--text)"
            strokeWidth={1.5}
            style={{
              transition: "d 300ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          />
          {/* Active-ply marker */}
          {activePoint && (
            <g>
              <line
                x1={activePoint.x}
                x2={activePoint.x}
                y1={0}
                y2={VB_H}
                stroke="var(--text)"
                strokeWidth={1}
                opacity={0.6}
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r={4}
                fill="var(--text)"
                stroke="var(--bg)"
                strokeWidth={1.5}
              />
            </g>
          )}
        </svg>
        {/* Click strip — overlays the svg, dispatches the ply based on x */}
        <button
          type="button"
          className="absolute inset-0 cursor-crosshair"
          onClick={(ev) => {
            const rect = (ev.currentTarget as HTMLButtonElement).getBoundingClientRect();
            const pct = ((ev.clientX - rect.left) / rect.width) * 100;
            onJumpTo(plyAtX(pct));
          }}
          aria-label="Jump to ply"
        />
      </div>
    </div>
  );
}

function evalToCp(m: ReviewedMove): number {
  // Show post-move evaluation (the position the user is staring at
  // when this ply is active). Use White-POV throughout the graph.
  if (m.evalAfter.mate != null) {
    return m.evalAfter.mate > 0 ? CP_CLAMP : -CP_CLAMP;
  }
  return m.evalAfter.cp ?? 0;
}

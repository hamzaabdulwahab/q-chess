"use client";

import { useEffect, useRef } from "react";
import type { ReviewedMove } from "@/lib/review/types";
import { CLASS_META } from "./ClassMeta";

const MOVES_LIST_MAX_HEIGHT = "16rem";

interface MoveStripReviewProps {
  moves: ReviewedMove[];
  activePly: number;
  onJumpTo: (ply: number) => void;
}

interface Row {
  full: number;
  white: ReviewedMove | null;
  black: ReviewedMove | null;
}

/**
 * Move list for the review surface. Each move shows its SAN plus a
 * tiny colored pip representing the classification; the active ply
 * gets an accent background.
 */
export function MoveStripReview({
  moves,
  activePly,
  onJumpTo,
}: MoveStripReviewProps) {
  const rows = buildRows(moves);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  // Skip the very first activePly value: on mount the user hasn't
  // navigated yet, so auto-scrolling would steal focus from the top of
  // the dashboard (accuracy arcs).
  const didMountRef = useRef(false);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    const row = activeRef.current;
    const scroller = scrollerRef.current;
    if (!row || !scroller) return;
    // Manual "nearest" scroll within OUR scroller only — never falls
    // through to scroll the parent aside.
    const rRect = row.getBoundingClientRect();
    const sRect = scroller.getBoundingClientRect();
    if (rRect.top < sRect.top) {
      scroller.scrollTop -= sRect.top - rRect.top;
    } else if (rRect.bottom > sRect.bottom) {
      scroller.scrollTop += rRect.bottom - sRect.bottom;
    }
  }, [activePly]);

  return (
    <div className="flex flex-col">
      <header
        className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <span
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-3)" }}
        >
          Moves
        </span>
        <span
          className="text-[10px] tabular-nums"
          style={{ color: "var(--text-3)" }}
        >
          {moves.length}
        </span>
      </header>

      <div
        ref={scrollerRef}
        className="scrollbar-thin overflow-y-auto"
        style={{ maxHeight: MOVES_LIST_MAX_HEIGHT }}
      >
        <ol className="text-sm">
          {rows.map((row) => (
            <li
              key={row.full}
              className="grid grid-cols-[2.25rem_1fr_1fr] items-center gap-1 px-3 py-1"
            >
              <span
                className="text-[11px] tabular-nums"
                style={{ color: "var(--text-3)" }}
              >
                {row.full}.
              </span>
              <MoveCell
                move={row.white}
                isActive={row.white?.ply === activePly}
                onClick={() => row.white && onJumpTo(row.white.ply)}
                rowRef={row.white?.ply === activePly ? activeRef : undefined}
              />
              <MoveCell
                move={row.black}
                isActive={row.black?.ply === activePly}
                onClick={() => row.black && onJumpTo(row.black.ply)}
                rowRef={row.black?.ply === activePly ? activeRef : undefined}
              />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function MoveCell({
  move,
  isActive,
  onClick,
  rowRef,
}: {
  move: ReviewedMove | null;
  isActive: boolean;
  onClick: () => void;
  rowRef?: React.RefObject<HTMLDivElement | null>;
}) {
  if (!move) return <span />;
  const meta = CLASS_META[move.classification];
  return (
    <div
      ref={rowRef}
      className="flex min-w-0 items-center gap-1.5 rounded px-1.5 py-0.5 transition-colors"
      style={{
        background: isActive ? "var(--accent-soft)" : "transparent",
        cursor: "pointer",
      }}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          onClick();
        }
      }}
    >
      <span
        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: meta.cssVar }}
        aria-label={meta.label}
      />
      <span
        className="truncate"
        style={{
          color: isActive ? "var(--text)" : "var(--text)",
          fontWeight: isActive ? 600 : 500,
        }}
      >
        {move.san}
      </span>
      {meta.tag && (
        <span
          className="font-mono text-[10px]"
          style={{ color: meta.cssVar }}
        >
          {meta.tag}
        </span>
      )}
    </div>
  );
}

function buildRows(moves: ReviewedMove[]): Row[] {
  const rows: Row[] = [];
  for (const m of moves) {
    const full = Math.ceil(m.ply / 2);
    let row = rows[full - 1];
    if (!row) {
      row = { full, white: null, black: null };
      rows.push(row);
    }
    if (m.player === "white") row.white = m;
    else row.black = m;
  }
  return rows;
}

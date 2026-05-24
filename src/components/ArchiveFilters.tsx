"use client";

import React from "react";
import { Crown, Handshake, Play, Scale, CheckCircle2, X } from "lucide-react";

export type Category =
  | "all"
  | "active"
  | "completed"
  | "checkmate"
  | "draw"
  | "stalemate";
export type Winner = "all" | "white" | "black" | "draw" | "none";

type Props = {
  category: Category;
  onCategoryChange: (c: Category) => void;
  winner: Winner;
  onWinnerChange: (w: Winner) => void;
  total: number;
  filtered: number;
  className?: string;
};

function Chip({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      aria-pressed={active}
      className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-none"
      style={{
        background: active ? "var(--accent-soft)" : "transparent",
        color: active ? "var(--text)" : "var(--text-2)",
        border: `1px solid ${active ? "var(--text)" : "var(--border)"}`,
      }}
    >
      {children}
    </button>
  );
}

export function ArchiveFilters({
  category,
  onCategoryChange,
  winner,
  onWinnerChange,
  total,
  filtered,
  className,
}: Props) {
  return (
    <div className={`surface-card p-2.5 ${className || ""}`}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 overflow-x-auto scrollbar-hide">
          <div className="inline-flex items-center gap-1.5">
            <span
              className="mr-1 text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-3)" }}
            >
              Category
            </span>
            <Chip
              active={category === "all"}
              onClick={() => onCategoryChange("all")}
            >
              All
            </Chip>
            <Chip
              active={category === "active"}
              onClick={() => onCategoryChange("active")}
            >
              <Play className="h-3 w-3" />
              Active
            </Chip>
            <Chip
              active={category === "completed"}
              onClick={() => onCategoryChange("completed")}
            >
              <CheckCircle2 className="h-3 w-3" />
              Done
            </Chip>
            <Chip
              active={category === "checkmate"}
              onClick={() => onCategoryChange("checkmate")}
            >
              <Crown className="h-3 w-3" />
              Mate
            </Chip>
            <Chip
              active={category === "draw"}
              onClick={() => onCategoryChange("draw")}
            >
              <Handshake className="h-3 w-3" />
              Draw
            </Chip>
            <Chip
              active={category === "stalemate"}
              onClick={() => onCategoryChange("stalemate")}
            >
              <Scale className="h-3 w-3" />
              Stale
            </Chip>

            <span
              aria-hidden="true"
              className="mx-2 inline-block h-4 w-px"
              style={{ background: "var(--border)" }}
            />

            <span
              className="mr-1 text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-3)" }}
            >
              Winner
            </span>
            <Chip
              active={winner === "all"}
              onClick={() => onWinnerChange("all")}
            >
              All
            </Chip>
            <Chip
              active={winner === "white"}
              onClick={() => onWinnerChange("white")}
            >
              White
            </Chip>
            <Chip
              active={winner === "black"}
              onClick={() => onWinnerChange("black")}
            >
              Black
            </Chip>
            <Chip
              active={winner === "draw"}
              onClick={() => onWinnerChange("draw")}
            >
              Draw
            </Chip>
            <Chip
              active={winner === "none"}
              onClick={() => onWinnerChange("none")}
            >
              None
            </Chip>
          </div>
        </div>

        <div className="flex flex-none items-center gap-2 border-l border-[var(--border)] pl-2">
          <span
            className="text-xs tabular-nums"
            style={{ color: "var(--text-3)" }}
          >
            <span style={{ color: "var(--text-2)" }}>{filtered}</span>
            <span> of {total}</span>
          </span>
          {(category !== "all" || winner !== "all") && (
            <button
              type="button"
              onClick={() => {
                onCategoryChange("all");
                onWinnerChange("all");
              }}
              className="btn-ghost inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs"
              title="Clear filters"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ArchiveFilters;

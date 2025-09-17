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
      className={`inline-flex h-9 items-center gap-2 px-4 rounded-full border transition-all duration-200 text-[13px] whitespace-nowrap select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.99] backdrop-saturate-125 ${
        active
          ? "border-accent/50 text-accent bg-[linear-gradient(135deg,rgba(167,139,250,0.18),rgba(236,72,153,0.12))] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_2px_rgba(167,139,250,0.15)]"
          : "border-white/10 bg-white/5 text-gray-300 hover:border-accent/40 hover:bg-white/7 hover:text-white"
      }`}
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
    <div
      className={`relative rounded-2xl p-[1.5px] bg-[linear-gradient(135deg,rgba(167,139,250,0.35),rgba(217,70,239,0.25),rgba(59,130,246,0.25))] ${
        className || ""
      }`}
    >
      <div className="rounded-2xl border border-white/10 bg-gray-900/70 backdrop-blur-md p-3 ring-1 ring-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.25)]">
        <div className="flex items-center gap-3">
          {/* Scrollable chips strip (both groups combined) */}
          <div className="min-w-0 flex-1 overflow-x-auto x-scroll-fade scrollbar-hide">
            <div className="inline-flex items-center gap-2 md:gap-3 pl-4 pr-4">
              <span className="text-[11px] uppercase text-gray-400/90 min-w-max tracking-wider font-medium">
                Category
              </span>
              <Chip
                active={category === "all"}
                onClick={() => onCategoryChange("all")}
                title="All"
              >
                All
              </Chip>
              <Chip
                active={category === "active"}
                onClick={() => onCategoryChange("active")}
                title="Active"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Active</span>
              </Chip>
              <Chip
                active={category === "completed"}
                onClick={() => onCategoryChange("completed")}
                title="Completed"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Completed</span>
              </Chip>
              <Chip
                active={category === "checkmate"}
                onClick={() => onCategoryChange("checkmate")}
                title="Checkmate"
              >
                <Crown className="w-3.5 h-3.5" />
                <span>Checkmate</span>
              </Chip>
              <Chip
                active={category === "draw"}
                onClick={() => onCategoryChange("draw")}
                title="Draw"
              >
                <Handshake className="w-3.5 h-3.5" />
                <span>Draw</span>
              </Chip>
              <Chip
                active={category === "stalemate"}
                onClick={() => onCategoryChange("stalemate")}
                title="Stalemate"
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Stalemate</span>
              </Chip>

              {/* Divider within scroll strip */}
              <div
                className="h-6 w-px rounded-full bg-gradient-to-b from-transparent via-white/12 to-transparent"
                aria-hidden
              />

              <span className="text-[11px] uppercase text-gray-400/90 min-w-max tracking-wider font-medium">
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
                No winner
              </Chip>
            </div>
          </div>

          {/* Meta + Clear (fixed at right) */}
          <div className="flex-none flex items-center gap-3 pl-1">
            <div className="text-[13px] text-gray-400">
              Showing{" "}
              <span className="text-accent font-semibold">{filtered}</span> of{" "}
              {total}
            </div>
            <button
              type="button"
              onClick={() => {
                onCategoryChange("all");
                onWinnerChange("all");
              }}
              className="inline-flex h-9 items-center gap-2 px-3 rounded-full border border-white/10 bg-transparent text-gray-300 hover:text-white hover:border-accent/40 hover:bg-white/5 transition"
              title="Clear filters"
            >
              <X className="w-4 h-4" />
              <span>Clear</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ArchiveFilters;

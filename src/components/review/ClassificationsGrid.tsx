"use client";

import type { Classification } from "@/lib/review/types";
import { CLASS_META, CLASS_ORDER } from "./ClassMeta";

interface ClassificationsGridProps {
  white: Record<Classification, number>;
  black: Record<Classification, number>;
  activeClassification?: Classification | null;
}

/**
 * Per-class counts for both sides, laid out as a 10-row table with
 * white on the left and black on the right of the icon column.
 * The active classification (i.e. the one for the currently-selected
 * move) gets a subtle background tint.
 */
export function ClassificationsGrid({
  white,
  black,
  activeClassification,
}: ClassificationsGridProps) {
  return (
    <div
      className="px-1 py-2"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <header className="flex items-center justify-between px-3 pb-2">
        <span
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-3)" }}
        >
          Move classifications
        </span>
      </header>
      <ul className="grid">
        {CLASS_ORDER.map((cls) => {
          const meta = CLASS_META[cls];
          const Icon = meta.icon;
          const isActive = activeClassification === cls;
          return (
            <li
              key={cls}
              className="grid grid-cols-[3rem_1fr_3rem] items-center gap-2 px-3 py-1.5 transition-colors"
              style={{
                background: isActive ? "var(--accent-soft)" : "transparent",
              }}
            >
              <span
                className="text-right text-sm font-semibold tabular-nums"
                style={{ color: "var(--text)" }}
              >
                {white[cls] ?? 0}
              </span>
              <span className="flex items-center justify-center gap-2">
                <Icon className="h-3.5 w-3.5" style={{ color: meta.cssVar }} />
                <span
                  className="text-xs"
                  style={{ color: "var(--text-2)" }}
                >
                  {meta.label}
                </span>
              </span>
              <span
                className="text-left text-sm font-semibold tabular-nums"
                style={{ color: "var(--text)" }}
              >
                {black[cls] ?? 0}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

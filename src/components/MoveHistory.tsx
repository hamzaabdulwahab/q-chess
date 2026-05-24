"use client";

import { useEffect, useRef } from "react";

export interface MoveHistoryEntry {
  // SAN notation, e.g. "Nf3", "exd5", "O-O", "Qxh7#".
  move_notation: string;
  // Who made the move.
  player: "white" | "black";
  // Server timestamp when the move was recorded.
  created_at?: string | null;
}

interface MoveHistoryProps {
  moves: MoveHistoryEntry[];
  // Used to anchor "time per move" calculations to the start of the game.
  startedAt?: string | null;
  // Optional slot rendered on the right side of the header — used by the
  // board page to mount its side-panel collapse toggle.
  headerRightSlot?: React.ReactNode;
}

// Returns "M:SS" or "S.Ds" for short durations. Hides the row when the
// timestamp pair isn't available (e.g. local hot-seat games that don't
// persist moves).
function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "";
  if (ms < 10_000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

interface RowData {
  fullMove: number;
  white: MoveHistoryEntry | null;
  black: MoveHistoryEntry | null;
  whiteTime: string;
  blackTime: string;
}

function buildRows(
  moves: MoveHistoryEntry[],
  startedAt: string | null | undefined,
): RowData[] {
  const rows: RowData[] = [];

  // Track the timestamp before each move so we can derive how long that
  // player took. White's first move is anchored to startedAt (or the move
  // itself if startedAt is missing). Subsequent moves are anchored to the
  // previous move's timestamp.
  let prevWhiteTs = startedAt ? new Date(startedAt).getTime() : null;
  let prevBlackTs: number | null = null;

  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    const fullMove = Math.floor(i / 2) + 1;
    let row = rows[fullMove - 1];
    if (!row) {
      row = {
        fullMove,
        white: null,
        black: null,
        whiteTime: "",
        blackTime: "",
      };
      rows.push(row);
    }

    const ts = m.created_at ? new Date(m.created_at).getTime() : null;
    if (m.player === "white") {
      row.white = m;
      if (ts != null && prevWhiteTs != null) {
        row.whiteTime = formatDuration(ts - prevWhiteTs);
      }
      // Black's clock has been ticking since white's previous turn ended,
      // so anchor black's "time-spent" baseline to white's just-played ts.
      prevBlackTs = ts;
    } else {
      row.black = m;
      if (ts != null && prevBlackTs != null) {
        row.blackTime = formatDuration(ts - prevBlackTs);
      }
      prevWhiteTs = ts;
    }
  }
  return rows;
}

export function MoveHistory({ moves, startedAt, headerRightSlot }: MoveHistoryProps) {
  const rows = buildRows(moves, startedAt);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the latest move when a move is added.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [moves.length]);

  return (
    <div className="flex h-full flex-col">
      <header
        className="flex items-center justify-between gap-2 px-3 py-2.5"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <span
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-3)" }}
        >
          Moves
        </span>
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] tabular-nums"
            style={{ color: "var(--text-3)" }}
          >
            {moves.length}
          </span>
          {headerRightSlot}
        </div>
      </header>

      <div
        ref={scrollerRef}
        className="scrollbar-thin flex-1 overflow-y-auto"
        style={{ scrollBehavior: "smooth" }}
      >
        {rows.length === 0 ? (
          <div
            className="px-3 py-6 text-center text-xs"
            style={{ color: "var(--text-3)" }}
          >
            No moves yet
          </div>
        ) : (
          <ol className="text-sm">
            {rows.map((row, idx) => {
              const isLastRow = idx === rows.length - 1;
              return (
                <li
                  key={row.fullMove}
                  className="grid min-h-[28px] grid-cols-[2.25rem_1fr_1fr] items-center gap-2 px-3 py-1.5 transition-colors hover:bg-[var(--surface-1)]"
                  style={{
                    background:
                      idx % 2 === 0 ? "transparent" : "var(--surface-1)",
                  }}
                >
                  <span
                    className="text-[11px] tabular-nums"
                    style={{ color: "var(--text-3)" }}
                  >
                    {row.fullMove}.
                  </span>
                  <div className="min-w-0">
                    {row.white && (
                      <div
                        className="flex items-baseline gap-1.5 truncate"
                        style={{
                          color: isLastRow && !row.black
                            ? "var(--accent)"
                            : "var(--text)",
                          fontWeight: isLastRow && !row.black ? 600 : 500,
                        }}
                      >
                        <span className="truncate">{row.white.move_notation}</span>
                        {row.whiteTime && (
                          <span
                            className="text-[10px] tabular-nums"
                            style={{ color: "var(--text-3)" }}
                          >
                            {row.whiteTime}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    {row.black && (
                      <div
                        className="flex items-baseline gap-1.5 truncate"
                        style={{
                          color: isLastRow
                            ? "var(--accent)"
                            : "var(--text)",
                          fontWeight: isLastRow ? 600 : 500,
                        }}
                      >
                        <span className="truncate">{row.black.move_notation}</span>
                        {row.blackTime && (
                          <span
                            className="text-[10px] tabular-nums"
                            style={{ color: "var(--text-3)" }}
                          >
                            {row.blackTime}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

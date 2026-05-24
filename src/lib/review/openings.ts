// Lightweight opening-book lookup used by `classifyMove` to flag
// theoretical moves. A move is considered "book" iff some line in the
// embedded library matches the entire game played so far AND has at
// least one more move beyond it — so we only mark moves *inside* a
// known line, not the move that diverges from it.

import data from "./openings.json";

interface OpeningEntry {
  eco: string;
  name: string;
  uci: string[];
}

const OPENINGS: OpeningEntry[] = data as OpeningEntry[];

/**
 * True when the next move is still inside a known opening line —
 * i.e. some entry's prefix equals `gameUciPrefix` AND has more moves.
 */
export function isBookMove(gameUciPrefix: string[]): boolean {
  if (gameUciPrefix.length >= 20) return false; // hard cap on theory depth
  return OPENINGS.some((o) => {
    if (o.uci.length <= gameUciPrefix.length) return false;
    for (let i = 0; i < gameUciPrefix.length; i++) {
      if (o.uci[i] !== gameUciPrefix[i]) return false;
    }
    return true;
  });
}

/**
 * Best-matching ECO line for the given prefix (longest exact prefix
 * match wins). Returns null when the game has already left book.
 */
export function matchOpening(
  gameUciPrefix: string[],
): { eco: string; name: string } | null {
  let best: OpeningEntry | null = null;
  for (const o of OPENINGS) {
    if (o.uci.length > gameUciPrefix.length) continue;
    let match = true;
    for (let i = 0; i < o.uci.length; i++) {
      if (o.uci[i] !== gameUciPrefix[i]) {
        match = false;
        break;
      }
    }
    if (match && (!best || o.uci.length > best.uci.length)) best = o;
  }
  return best ? { eco: best.eco, name: best.name } : null;
}

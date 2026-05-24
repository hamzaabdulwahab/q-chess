/**
 * Tiny in-memory token-bucket rate limiter for bot move requests.
 * Per-user; module-scoped. Resets when the Node process restarts which
 * is fine for v1 — the engine call itself is the real bottleneck.
 *
 * Limits a single user to N bot-move requests per minute, defaulting to
 * 60 (so a long blitz game can stay under the line). Defenses against a
 * user looping `bot-move` to extract engine analysis on a long-running
 * position.
 */

const WINDOW_MS = 60_000;
const DEFAULT_MAX = 60;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function checkBotMoveRateLimit(userId: string): {
  ok: boolean;
  remaining: number;
  retryAfterMs?: number;
} {
  const now = Date.now();
  const max = Math.max(
    10,
    Number(process.env.STOCKFISH_RATE_LIMIT_PER_MINUTE) || DEFAULT_MAX,
  );
  const existing = buckets.get(userId);
  if (!existing || existing.resetAt <= now) {
    buckets.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, remaining: max - 1 };
  }
  if (existing.count >= max) {
    return {
      ok: false,
      remaining: 0,
      retryAfterMs: existing.resetAt - now,
    };
  }
  existing.count += 1;
  return { ok: true, remaining: max - existing.count };
}


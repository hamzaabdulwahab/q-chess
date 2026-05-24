"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AnalysisProgress,
  GameAnalysisResponse,
  ReviewedMove,
} from "@/lib/review/types";

type Status =
  | "loading"        // initial GET in flight
  | "analyzing"      // POST in flight; we poll for progress
  | "ready"          // analysis present, dashboard renderable
  | "error";

interface UseReviewState {
  status: Status;
  error: string | null;
  data: GameAnalysisResponse | null;
  progress: AnalysisProgress | null;
  activePly: number;          // 0 = pre-game, 1..N = after that ply
  activeMove: ReviewedMove | null;
  activeFen: string;          // FEN to display on the board
  next: () => void;
  prev: () => void;
  jumpTo: (ply: number) => void;
}

const STARTPOS = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function useReview(gameId: number | null): UseReviewState {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GameAnalysisResponse | null>(null);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [activePly, setActivePly] = useState<number>(0);

  // Keep the live data in a ref so the keyboard handler doesn't need
  // to re-bind on every render.
  const dataRef = useRef(data);
  dataRef.current = data;

  // ── Bootstrapping ────────────────────────────────────────────────
  // 1) Try GET /analysis (cache hit → ready)
  // 2) On miss, POST /analyze and start polling progress
  // 3) When the POST resolves with data, set ready

  useEffect(() => {
    if (gameId == null) return;
    let cancelled = false;
    // Track any active poll interval so the cleanup can stop it even
    // if the in-flight analyze POST never resolves (e.g. the user
    // navigates away mid-analysis). Without this the interval would
    // keep firing on a dead component until the fetch eventually
    // settled, leaking memory and bandwidth.
    let pollId: number | null = null;

    (async () => {
      try {
        const cached = await safeJsonFetch(
          `/api/games/${gameId}/analysis`,
          { cache: "no-store" },
        );
        if (cancelled) return;

        if (cached && cached.summary) {
          setData(cached as unknown as GameAnalysisResponse);
          // Start at the beginning of the game so the user sees the
          // opening, not the final position.
          setActivePly(0);
          setStatus("ready");
          return;
        }

        // Not cached — kick off analysis and poll for progress.
        setStatus("analyzing");
        const analyzePromise = safeJsonFetch(`/api/games/${gameId}/analyze`, {
          method: "POST",
        });

        pollId = window.setInterval(async () => {
          const p = await safeJsonFetch(
            `/api/games/${gameId}/analysis?probe=true`,
            { cache: "no-store" },
          );
          if (cancelled) return;
          if (p && typeof p === "object" && "totalPlies" in p) {
            setProgress(p as unknown as AnalysisProgress);
          }
        }, 1500);

        const finalPayload = await analyzePromise;
        if (pollId != null) {
          window.clearInterval(pollId);
          pollId = null;
        }
        if (cancelled) return;

        if (!finalPayload) {
          setError(
            "The analysis request failed unexpectedly. Try refreshing.",
          );
          setStatus("error");
          return;
        }
        if (finalPayload.error) {
          setError(String(finalPayload.error));
          setStatus("error");
          return;
        }
        setData(finalPayload as unknown as GameAnalysisResponse);
        setActivePly(0);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load review");
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      if (pollId != null) {
        window.clearInterval(pollId);
        pollId = null;
      }
    };
  }, [gameId]);

  // ── Active move + derived FEN ────────────────────────────────────
  const moves = data?.moves ?? [];
  const activeMove =
    activePly > 0 && activePly <= moves.length ? moves[activePly - 1] : null;
  const activeFen = activeMove ? activeMove.fenAfter : STARTPOS;

  // ── Navigation actions ───────────────────────────────────────────
  const jumpTo = useCallback(
    (ply: number) => {
      const total = dataRef.current?.moves.length ?? 0;
      const clamped = Math.max(0, Math.min(total, ply));
      setActivePly(clamped);
    },
    [],
  );
  const next = useCallback(() => {
    jumpTo((dataRef.current?.moves.length ?? 0) === 0 ? 0 : Math.min((dataRef.current?.moves.length ?? 0), activePlyRef.current + 1));
  }, [jumpTo]);
  const prev = useCallback(() => {
    jumpTo(Math.max(0, activePlyRef.current - 1));
  }, [jumpTo]);

  // Track latest activePly in a ref so next/prev don't recreate per render.
  const activePlyRef = useRef(activePly);
  activePlyRef.current = activePly;

  // ── Keyboard arrows (global on this page) ────────────────────────
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      // Don't hijack typing in inputs.
      const tgt = ev.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable)) {
        return;
      }
      if (ev.key === "ArrowRight") {
        ev.preventDefault();
        next();
      } else if (ev.key === "ArrowLeft") {
        ev.preventDefault();
        prev();
      } else if (ev.key === "Home") {
        ev.preventDefault();
        jumpTo(0);
      } else if (ev.key === "End") {
        ev.preventDefault();
        jumpTo(dataRef.current?.moves.length ?? 0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, jumpTo]);

  return {
    status,
    error,
    data,
    progress,
    activePly,
    activeMove,
    activeFen,
    next,
    prev,
    jumpTo,
  };
}

// ──────────────────────────────────────────────────────────────────
// Fetch helper that tolerates dev-server hiccups: when the route
// hasn't been compiled yet, Next.js dev briefly serves an HTML error
// page even when the route handler would have returned valid JSON.
// We sniff the content-type, retry once with a short backoff on
// non-JSON responses, and return `null` when there's nothing useful.
// ──────────────────────────────────────────────────────────────────
async function safeJsonFetch(
  url: string,
  init?: RequestInit,
): Promise<Record<string, unknown> | null> {
  // In dev, Next.js can briefly serve an HTML error page while a route
  // is being compiled for the first time. We retry several times with
  // increasing backoff so a slow first compile doesn't fall through to
  // the "analyzing…" path on a cache hit.
  const maxAttempts = process.env.NODE_ENV === "development" ? 6 : 2;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const r = await fetch(url, init);
      const ct = r.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        const json = (await r.json()) as Record<string, unknown>;
        return json;
      }
      const text = await r.text();
      if (process.env.NODE_ENV === "development") {
        console.warn(
          `[useReview] non-JSON ${r.status} from ${url} (attempt ${attempt + 1}/${maxAttempts}): ${text.slice(0, 120)}…`,
        );
      }
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          `[useReview] fetch ${url} threw (attempt ${attempt + 1}/${maxAttempts})`,
          err,
        );
      }
    }
    // Exponential-ish backoff: 200, 400, 600, 800, 1000, 1200.
    await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
  }
  return null;
}

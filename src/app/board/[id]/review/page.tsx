"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowLeft,
} from "lucide-react";
import { ChessBoard } from "@/components/ChessBoard";
import { ThemeProvider } from "@/lib/theme-context";
import { ReviewHeader } from "@/components/review/ReviewHeader";
import { ClassificationsGrid } from "@/components/review/ClassificationsGrid";
import { EvalGraph } from "@/components/review/EvalGraph";
import { CoachPanel } from "@/components/review/CoachPanel";
import { MoveStripReview } from "@/components/review/MoveStripReview";
import { AnalyzeProgress } from "@/components/review/AnalyzeProgress";
import { useReview } from "@/components/review/hooks/use-review";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

interface ReviewPageProps {
  params: Promise<{ id: string }>;
}

export default function ReviewPage({ params }: ReviewPageProps) {
  const { id } = use(params);
  const gameId = Number(id);
  return (
    <ThemeProvider gameId={Number.isFinite(gameId) ? gameId : undefined}>
      <ReviewView gameId={Number.isFinite(gameId) ? gameId : null} />
    </ThemeProvider>
  );
}

function ReviewView({ gameId }: { gameId: number | null }) {
  const review = useReview(gameId);
  const playerNames = usePlayerNames(gameId);

  const lastMoveHighlight = useMemo(
    () =>
      review.activeMove?.highlight
        ? {
            from: review.activeMove.highlight.from,
            to: review.activeMove.highlight.to,
          }
        : null,
    [review.activeMove],
  );

  if (gameId == null) {
    return (
      <Shell>
        <div
          className="m-6 rounded-md p-4 text-sm"
          style={{
            background: "var(--danger-soft)",
            color: "var(--text)",
            border:
              "1px solid color-mix(in oklch, var(--danger) 40%, transparent)",
          }}
        >
          Invalid game id. <Link href="/archive" className="underline">Browse archive</Link>.
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex w-full flex-1 flex-col gap-4 px-4 py-4 md:flex-row md:items-start md:justify-center">
        {/* Left column: board + step controls */}
        <section className="flex min-w-0 flex-1 flex-col gap-2 md:max-w-[640px]">
          <div className="flex items-center justify-between">
            <Link
              href="/archive"
              className="btn-ghost inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Archive
            </Link>
            <span
              className="text-[11px] uppercase tracking-wider"
              style={{ color: "var(--text-3)" }}
            >
              Game Review
            </span>
            <span style={{ width: "5.25rem" }} />
          </div>

          <div className="flex items-center justify-center">
            <ChessBoard
              fen={review.activeFen}
              orientation="white"
              viewMode
              disabled
              hideEndScreen
              externalLastMove={lastMoveHighlight}
            />
          </div>

          {/* Step controls */}
          <div className="flex items-center justify-center gap-1.5 py-1">
            <StepButton
              onClick={() => review.jumpTo(0)}
              ariaLabel="Jump to start"
              icon={ChevronsLeft}
            />
            <StepButton
              onClick={review.prev}
              ariaLabel="Previous move"
              icon={ChevronLeft}
            />
            <div
              className="rounded-md px-3 py-1.5 font-mono text-xs tabular-nums"
              style={{
                background: "var(--surface-1)",
                color: "var(--text-2)",
                minWidth: "6ch",
                textAlign: "center",
              }}
            >
              {review.data
                ? `${review.activePly}/${review.data.moves.length}`
                : "0/0"}
            </div>
            <StepButton
              onClick={review.next}
              ariaLabel="Next move"
              icon={ChevronRight}
            />
            <StepButton
              onClick={() =>
                review.jumpTo(review.data?.moves.length ?? 0)
              }
              ariaLabel="Jump to end"
              icon={ChevronsRight}
            />
          </div>
        </section>

        {/* Right column: review dashboard */}
        <aside
          className="surface-card scrollbar-thin flex w-full flex-col overflow-y-auto md:w-[22rem] md:max-w-md md:self-stretch"
          style={{ maxHeight: "calc(100vh - 2rem)" }}
          aria-label="Game review dashboard"
        >
          {review.status === "loading" || review.status === "analyzing" ? (
            <AnalyzeProgress progress={review.progress} />
          ) : review.status === "error" ? (
            <div
              className="m-4 rounded-md p-4 text-sm"
              style={{
                background: "var(--danger-soft)",
                color: "var(--text)",
                border:
                  "1px solid color-mix(in oklch, var(--danger) 40%, transparent)",
              }}
            >
              {review.error ?? "Failed to load review."}
            </div>
          ) : review.data ? (
            <>
              <ReviewHeader
                summary={review.data.summary}
                whiteName={playerNames.white}
                blackName={playerNames.black}
              />
              <ClassificationsGrid
                white={review.data.summary.classificationCountsWhite}
                black={review.data.summary.classificationCountsBlack}
                activeClassification={review.activeMove?.classification ?? null}
              />
              <EvalGraph
                moves={review.data.moves}
                activePly={review.activePly}
                onJumpTo={review.jumpTo}
              />
              <CoachPanel move={review.activeMove} />
              <MoveStripReview
                moves={review.data.moves}
                activePly={review.activePly}
                onJumpTo={review.jumpTo}
              />
            </>
          ) : null}
        </aside>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen w-full"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      {children}
    </div>
  );
}

function StepButton({
  onClick,
  ariaLabel,
  icon: Icon,
}: {
  onClick: () => void;
  ariaLabel: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="btn-ghost grid h-8 w-8 place-items-center rounded-md"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────
// Fetch participant usernames so the accuracy cards show real names
// instead of just "White"/"Black".
// ──────────────────────────────────────────────────────────────────
function usePlayerNames(gameId: number | null): {
  white: string;
  black: string;
} {
  const [names, setNames] = useState<{ white: string; black: string }>({
    white: "White",
    black: "Black",
  });

  useEffect(() => {
    if (gameId == null) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/games/${gameId}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        const game = json.game ?? {};
        const whiteId: string | null = game.white_user_id ?? null;
        const blackId: string | null = game.black_user_id ?? null;
        const mode: string = game.mode ?? "";
        const botSide: string | null = game.bot_side ?? null;
        const botLevel: string | null = game.bot_level ?? null;

        const supabase = getSupabaseBrowser();
        const ids = [whiteId, blackId].filter(
          (x): x is string => typeof x === "string" && x.length > 0,
        );
        const map: Record<string, string> = {};
        if (ids.length > 0) {
          const { data } = await supabase
            .from("profiles")
            .select("id, username")
            .in("id", ids);
          for (const row of data ?? []) {
            map[(row as { id: string }).id] = (row as { username: string }).username;
          }
        }
        if (cancelled) return;
        const botLabel =
          mode === "human_vs_stockfish" && botLevel
            ? `Stockfish · ${botLevel}`
            : "Stockfish";
        setNames({
          white:
            mode === "human_vs_stockfish" && botSide === "white"
              ? botLabel
              : (whiteId && map[whiteId]) ?? "White",
          black:
            mode === "human_vs_stockfish" && botSide === "black"
              ? botLabel
              : (blackId && map[blackId]) ?? "Black",
        });
      } catch {
        // fall back to default labels
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  return names;
}

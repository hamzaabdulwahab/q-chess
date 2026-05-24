"use client";

import { Home, RotateCcw, Eye } from "lucide-react";

export type EndStatus =
  | "checkmate"
  | "stalemate"
  | "draw"
  | "resigned"
  | "timeout"
  | "abandoned";

export type Perspective = "won" | "lost" | "draw" | "neutral";

interface GameEndScreenProps {
  winner: "white" | "black" | "draw" | null;
  status: EndStatus;
  // Player's color in this game ('white' | 'black') if they're a participant,
  // else null (spectator / local hot-seat). Drives the headline from the
  // player's POV — "You won" vs. "You lost" vs. "Draw" vs. neutral.
  myColor?: "white" | "black" | null;
  // Opponent username for the byline. Omit for local games.
  opponentUsername?: string | null;
  // When present, "View board" dismisses the modal so the user can study
  // the final position on the actual board behind it.
  gameId?: number;
  onDismiss?: () => void;
}

function perspectiveOf(
  winner: "white" | "black" | "draw" | null,
  myColor: "white" | "black" | null | undefined,
): Perspective {
  if (winner === "draw") return "draw";
  if (!myColor) return "neutral";
  if (winner === myColor) return "won";
  if (winner === "white" || winner === "black") return "lost";
  return "neutral";
}

function methodLabel(status: EndStatus): string {
  switch (status) {
    case "checkmate":
      return "by checkmate";
    case "resigned":
      return "by resignation";
    case "timeout":
      return "on time";
    case "abandoned":
      return "by abandonment";
    case "stalemate":
      return "by stalemate";
    case "draw":
      return "by agreement";
    default:
      return "";
  }
}

function headlineFor(
  perspective: Perspective,
  winner: "white" | "black" | "draw" | null,
): string {
  if (perspective === "won") return "You won";
  if (perspective === "lost") return "You lost";
  if (perspective === "draw") return "Draw";
  if (winner === "white") return "White wins";
  if (winner === "black") return "Black wins";
  return "Game over";
}

function bylineFor(
  perspective: Perspective,
  status: EndStatus,
  opponentUsername: string | null | undefined,
): string {
  const method = methodLabel(status);
  if (perspective === "won" || perspective === "lost") {
    if (opponentUsername) {
      return perspective === "won"
        ? `${method} vs @${opponentUsername}`
        : `${method} to @${opponentUsername}`;
    }
    return method;
  }
  return method;
}

// Decide the icon and accent tint to use, by perspective.
function visualFor(perspective: Perspective): {
  icon: string;
  ring: string;
} {
  if (perspective === "won") {
    return {
      icon: "♔",
      ring: "var(--accent)",
    };
  }
  if (perspective === "lost") {
    return {
      icon: "♚",
      ring: "var(--text-3)",
    };
  }
  if (perspective === "draw") {
    return {
      icon: "½",
      ring: "var(--text-2)",
    };
  }
  return { icon: "♔", ring: "var(--accent)" };
}

export function GameEndScreen({
  winner,
  status,
  myColor,
  opponentUsername,
  gameId,
  onDismiss,
}: GameEndScreenProps) {
  const perspective = perspectiveOf(winner, myColor ?? null);
  const visual = visualFor(perspective);
  const headline = headlineFor(perspective, winner);
  const byline = bylineFor(perspective, status, opponentUsername);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "oklch(0 0 0 / 0.55)" }}
      onClick={onDismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-end-title"
    >
      <div
        className="relative w-full max-w-sm rounded-xl"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-lg)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-7 pb-5 flex flex-col items-center text-center">
          <div
            className="grid place-items-center rounded-full"
            style={{
              width: 56,
              height: 56,
              background: "var(--surface-1)",
              border: `1px solid ${visual.ring}`,
              color: "var(--text)",
              fontSize: 28,
              lineHeight: 1,
            }}
            aria-hidden="true"
          >
            {visual.icon}
          </div>
          <h2
            id="game-end-title"
            className="mt-4 text-xl font-semibold tracking-tight"
            style={{ color: "var(--text)" }}
          >
            {headline}
          </h2>
          {byline && (
            <p
              className="mt-1 text-sm"
              style={{ color: "var(--text-3)" }}
            >
              {byline}
            </p>
          )}
        </div>

        <div
          className="px-6 pb-6 pt-2 grid grid-cols-2 gap-2"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <button
            type="button"
            onClick={() => (window.location.href = "/board")}
            className="btn-secondary inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm"
          >
            <RotateCcw className="h-4 w-4" />
            New game
          </button>
          <button
            type="button"
            onClick={() => (window.location.href = "/")}
            className="btn-secondary inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm"
          >
            <Home className="h-4 w-4" />
            Lobby
          </button>
          {gameId && onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="btn-ghost col-span-2 inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm"
              style={{ color: "var(--text-2)" }}
            >
              <Eye className="h-4 w-4" />
              View board
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

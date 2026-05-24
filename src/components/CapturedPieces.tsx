"use client";

import Image from "next/image";

// captured_piece values stored in the moves table are lowercase chess.js
// piece types: p, n, b, r, q, k. King capture never happens in legal play
// but we tolerate it for type safety.
type PieceType = "p" | "n" | "b" | "r" | "q" | "k";

const PIECE_VALUES: Record<PieceType, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

// Display order: pawns first, then knights, bishops, rooks, queens.
const PIECE_ORDER: PieceType[] = ["p", "n", "b", "r", "q", "k"];

function imageFor(piece: PieceType, capturedFromColor: "white" | "black") {
  // capturedFromColor is the color of the piece that was captured.
  const colorPrefix = capturedFromColor === "white" ? "white" : "black";
  const names: Record<PieceType, string> = {
    p: "pawn",
    n: "knight",
    b: "bishop",
    r: "rook",
    q: "queen",
    k: "king",
  };
  return `/pieces/${colorPrefix}-${names[piece]}.png`;
}

interface CapturedPiecesProps {
  // The pieces this player has captured (i.e. opponent-color pieces taken).
  pieces: string[];
  // Color of the pieces in `pieces` (= opposite of the owning player).
  capturedFromColor: "white" | "black";
  // Material advantage over the opponent (positive only; null when not ahead).
  advantage: number | null;
}

function isPieceType(s: string): s is PieceType {
  return s === "p" || s === "n" || s === "b" || s === "r" || s === "q" || s === "k";
}

export function CapturedPieces({
  pieces,
  capturedFromColor,
  advantage,
}: CapturedPiecesProps) {
  const grouped = new Map<PieceType, number>();
  for (const raw of pieces) {
    if (!isPieceType(raw)) continue;
    grouped.set(raw, (grouped.get(raw) ?? 0) + 1);
  }

  const ordered = PIECE_ORDER.flatMap((piece) => {
    const count = grouped.get(piece) ?? 0;
    return Array.from({ length: count }, (_, i) => ({
      piece,
      key: `${piece}-${i}`,
    }));
  });

  return (
    <div className="flex items-center gap-1 min-h-[20px]">
      <div className="flex items-center -space-x-1.5">
        {ordered.map(({ piece, key }) => (
          <Image
            key={key}
            src={imageFor(piece, capturedFromColor)}
            alt={`captured ${piece}`}
            width={18}
            height={18}
            unoptimized
            className="opacity-90"
          />
        ))}
      </div>
      {advantage != null && advantage > 0 && (
        <span className="text-xs text-gray-300 font-semibold ml-1">
          +{advantage}
        </span>
      )}
    </div>
  );
}

export function computeMaterialAdvantage(
  capturedByMe: string[],
  capturedByOpponent: string[],
): number {
  const sum = (arr: string[]) =>
    arr.reduce((acc, p) => {
      if (!isPieceType(p)) return acc;
      return acc + PIECE_VALUES[p];
    }, 0);
  return sum(capturedByMe) - sum(capturedByOpponent);
}

"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { preload } from "react-dom";
import { ChessClient } from "@/lib/chess-client";
import { useSettings } from "@/lib/settings-context";
import { soundManager } from "@/lib/sound-manager";
import { GameEndScreen } from "./GameEndScreen";

// Helper functions
const coordsToSquare = (file: number, rank: number): string => {
  return String.fromCharCode(97 + file) + (rank + 1);
};

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

interface ChessBoardProps {
  gameId?: number;
  fen?: string;
  onMove?: (result: {
    success: boolean;
    fen: string;
    gameStatus?: string;
    // SAN of the move just made (e.g. "Nf3", "exd5", "O-O", "Qxh7#").
    move?: string;
    from?: string;
    to?: string;
    promotion?: string;
    // Flag-style metadata so the parent doesn't need to re-derive these
    // from the new FEN when shipping the move over Realtime Broadcast.
    isCapture?: boolean;
    isCheck?: boolean;
    isCheckmate?: boolean;
    isCastling?: boolean;
    isPromotion?: boolean;
    capturedPiece?: string;
  }) => void;
  onMoveCommitted?: (result: {
    fen: string;
    from: string;
    to: string;
    promotion?: string;
    clientMoveId: string;
    expectedPly: number;
  }) => void;
  onMoveRejected?: (result: {
    previousFen: string;
    from: string;
    to: string;
    reason: string;
  }) => void;
  disabled?: boolean;
  viewMode?: boolean;
  orientation?: "white" | "black";
  turn?: "white" | "black";
  // When true, the built-in fullscreen end-game modal is suppressed so the
  // parent can render its own non-blocking banner and the final board
  // position stays visible.
  hideEndScreen?: boolean;
  // Last move played by something *other* than this component's own click
  // handler (the bot, or the network opponent). Setting this triggers the
  // same slide-in animation we already play for the local user's moves so
  // the player can see what just changed.
  externalLastMove?: { from: string; to: string } | null;
  currentMoveCount?: number;
}

interface PieceProps {
  piece: string;
}

type DragSnapshot = {
  pointerId: number;
  from: string;
  piece: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
  dragging: boolean;
  shouldClick: boolean;
  squareSize: number;
};

// Piece → PNG asset (public/pieces) and unicode fallback. Hoisted to module
// scope so they are allocated once, not rebuilt on every Piece render.
const PIECE_IMAGES: Record<string, string> = {
  wK: "white-king.png",
  wQ: "white-queen.png",
  wR: "white-rook.png",
  wB: "white-bishop.png",
  wN: "white-knight.png",
  wP: "white-pawn.png",
  bK: "black-king.png",
  bQ: "black-queen.png",
  bR: "black-rook.png",
  bB: "black-bishop.png",
  bN: "black-knight.png",
  bP: "black-pawn.png",
};

const PIECE_SYMBOLS: Record<string, string> = {
  wK: "♔",
  wQ: "♕",
  wR: "♖",
  wB: "♗",
  wN: "♘",
  wP: "♙",
  bK: "♚",
  bQ: "♛",
  bR: "♜",
  bB: "♝",
  bN: "♞",
  bP: "♟",
};

const PIECE_IMAGE_PATHS = Object.values(PIECE_IMAGES).map((f) => `/pieces/${f}`);

function pieceImagePath(piece: string): string | null {
  const filename = PIECE_IMAGES[piece];
  return filename ? `/pieces/${filename}` : null;
}

const Piece = React.memo(function Piece({ piece }: PieceProps) {
  // The bundled PNGs are static assets that essentially never 404 in
  // production; we keep a one-way error latch for the unicode fallback but no
  // longer run a reset effect on every piece change (that effect fired an extra
  // commit on every capture/replacement).
  const [imageError, setImageError] = useState(false);
  const imagePath = pieceImagePath(piece);
  const color = piece[0] === "w" ? "text-white" : "text-gray-300";

  return (
    <div className="flex h-full w-full touch-none select-none items-center justify-center pointer-events-none">
      {!imageError && imagePath ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imagePath}
          alt={piece}
          width={97}
          height={97}
          className="chess-piece-image max-h-full max-w-full touch-none object-contain"
          data-color={piece[0] === "w" ? "white" : "black"}
          draggable={false}
          decoding="async"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className={`chess-piece-fallback touch-none text-4xl font-bold ${color}`}>
          {PIECE_SYMBOLS[piece] || ""}
        </div>
      )}
    </div>
  );
});

interface SquareProps {
  square: string;
  rank: number;
  file: number;
  piece?: string | null;
  isLight: boolean;
  isSelected: boolean;
  isHighlighted: boolean;
  isLastMove: boolean;
  isCheck: boolean;
  isCheckingPiece: boolean;
  onSquareClick: (square: string) => void;
  onSquarePointerDown: (
    square: string,
    piece: string | null | undefined,
    event: React.PointerEvent<HTMLDivElement>,
  ) => void;
  fileLabel?: string | null;
  rankLabel?: string | null;
  // When this square is the destination of a move just played, animateFrom
  // carries the source delta in % units so the piece can slide in from
  // its prior square. Null when no animation is in flight.
  animateFrom?: { dx: string; dy: string } | null;
  isDraggingSource?: boolean;
  isDragTarget?: boolean;
  isLegalDragTarget?: boolean;
  isConfirmTarget?: boolean;
  onConfirmMove: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

const Square = React.memo(function Square({
  square,
  piece,
  isLight,
  isSelected,
  isHighlighted,
  isLastMove,
  isCheck,
  isCheckingPiece,
  onSquareClick,
  onSquarePointerDown,
  fileLabel,
  rankLabel,
  animateFrom,
  isDraggingSource = false,
  isDragTarget = false,
  isLegalDragTarget = false,
  isConfirmTarget = false,
  onConfirmMove,
}: SquareProps) {
  const [hovered, setHovered] = useState(false);

  // Colors come from the [data-chess-theme] CSS variables set on <html> before
  // paint (see themeVarsCss + the root layout). Reading them as static var()
  // strings instead of from context means Square no longer subscribes to the
  // theme context: all 64 squares stop re-rendering on a theme change (the
  // browser just re-resolves the variables) and React.memo can fully shield
  // unchanged squares during play.
  const baseColor = isLight ? "var(--sq-light)" : "var(--sq-dark)";
  const hoverColor = isLight ? "var(--sq-light-hover)" : "var(--sq-dark-hover)";
  const coordColor = isLight ? "var(--coord-on-light)" : "var(--coord-on-dark)";

  const squareClasses = [
    "chess-square-large flex items-center justify-center relative cursor-pointer transition-colors duration-100",
  ].join(" ");

  const overlayNodes: React.ReactNode[] = [];
  if (isLastMove) {
    overlayNodes.push(
      <div
        key="last"
        className="absolute inset-0 pointer-events-none"
        style={{ backgroundColor: "var(--last-move)" }}
      />,
    );
  }
  if (isHighlighted) {
    overlayNodes.push(
      <div
        key="hl"
        className="absolute inset-0 pointer-events-none"
        style={{ backgroundColor: "var(--move-hint)" }}
      />,
    );
  }
  if (isCheck || isCheckingPiece) {
    overlayNodes.push(
      <div
        key="check"
        className="absolute inset-0 pointer-events-none"
        style={{ backgroundColor: "var(--check-highlight)" }}
      />,
    );
  }
  if (isSelected) {
    overlayNodes.push(
      <div
        key="sel"
        className="absolute inset-0 pointer-events-none border-4 border-white/85"
        style={{
          boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.4)",
        }}
      />,
    );
  }
  if (isDragTarget) {
    overlayNodes.push(
      <div
        key="drag-target"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundColor: isLegalDragTarget
            ? "oklch(0.82 0.11 145 / 0.22)"
            : "oklch(0.62 0.13 25 / 0.18)",
          boxShadow: `inset 0 0 0 3px ${
            isLegalDragTarget
              ? "oklch(0.82 0.11 145 / 0.78)"
              : "oklch(0.62 0.13 25 / 0.72)"
          }`,
        }}
      />,
    );
  }

  return (
    <div
      className={squareClasses}
      data-square={square}
      onClick={() => onSquareClick(square)}
      onPointerDown={(event) => onSquarePointerDown(square, piece, event)}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      style={{
        backgroundColor: hovered ? hoverColor : baseColor,
        touchAction: piece ? "none" : "auto",
      }}
    >
      {overlayNodes}
      <div
        className={
          "square-content w-full h-full flex items-center justify-center relative z-10" +
          (animateFrom ? " piece-animating" : "")
        }
        style={
          animateFrom
            ? ({
                "--piece-dx": animateFrom.dx,
                "--piece-dy": animateFrom.dy,
                opacity: isDraggingSource ? 0 : 1,
              } as React.CSSProperties)
            : ({ opacity: isDraggingSource ? 0 : 1 } as React.CSSProperties)
        }
      >
        {piece && <Piece piece={piece} />}
      </div>
      {(fileLabel || rankLabel) && (
        <>
          {fileLabel && (
            <div
              className="coord absolute bottom-1 left-1 text-sm font-bold z-20"
              style={{ color: coordColor }}
            >
              {fileLabel}
            </div>
          )}
          {rankLabel && (
            <div
              className="coord absolute top-1 left-1 text-sm font-bold z-20"
              style={{ color: coordColor }}
            >
              {rankLabel}
            </div>
          )}
        </>
      )}
      {isConfirmTarget && (
        <button
          type="button"
          onClick={onConfirmMove}
          className="absolute right-1 top-1 z-30 grid h-7 w-7 place-items-center rounded-full border border-white/60 bg-emerald-500 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          aria-label="Confirm move"
          title="Confirm move"
        >
          ✓
        </button>
      )}
    </div>
  );
});

interface PromotionPopoverProps {
  show: boolean;
  color: "white" | "black";
  targetSquare: string | null;
  getAnchorStyle: (square: string | null) => React.CSSProperties;
  onSelect: (piece: string) => void;
  onCancel: () => void;
}

const PromotionPopover: React.FC<PromotionPopoverProps> = ({
  show,
  color,
  targetSquare,
  getAnchorStyle,
  onSelect,
  onCancel,
}) => {
  if (!show) return null;

  const pieces = ["q", "r", "b", "n"] as const; // queen, rook, bishop, knight
  const labels: Record<(typeof pieces)[number], string> = {
    q: "Queen",
    r: "Rook",
    b: "Bishop",
    n: "Knight",
  };

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-50 cursor-default bg-black/20"
        aria-label="Cancel promotion"
        onClick={onCancel}
      />
      <div
        className="fixed z-[60] rounded-lg p-2 shadow-2xl"
        style={{
          ...getAnchorStyle(targetSquare),
          background: "var(--surface)",
          border: "1px solid var(--border-strong)",
        }}
      >
        <div className="grid grid-cols-4 gap-1.5">
          {pieces.map((p) => {
            const pieceCode = `${color[0]}${p.toUpperCase()}`;
            return (
              <button
                key={p}
                onClick={() => onSelect(p)}
                className="grid h-20 w-16 place-items-center rounded-md border border-white/10 bg-white/[0.04] p-1 transition-colors hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                title={labels[p]}
                aria-label={`Promote to ${labels[p]}`}
              >
                <Piece piece={pieceCode} />
                <span className="text-[10px] font-medium text-gray-300">
                  {labels[p]}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};

export const ChessBoard: React.FC<ChessBoardProps> = ({
  gameId,
  fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  onMove,
  onMoveCommitted,
  onMoveRejected,
  disabled = false,
  viewMode = false,
  orientation = "white",
  turn: turnProp,
  hideEndScreen = false,
  externalLastMove = null,
  currentMoveCount = 0,
}) => {
  const { settings } = useSettings();
  const [chessService, setChessService] = useState<ChessClient>(
    new ChessClient(fen),
  );
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [gameState, setGameState] = useState({
    fen,
    turn: "white" as "white" | "black",
    inCheck: false,
    gameOver: false,
    winner: null as string | null,
    skipEndScreen: false,
  });
  const [pendingMove, setPendingMove] = useState<{
    from: string;
    to: string;
    promotion?: string;
  } | null>(null);
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [confirmMove, setConfirmMove] = useState<{
    from: string;
    to: string;
    promotion?: string;
  } | null>(null);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(
    null,
  );
  const [lastMoveAnimationEnabled, setLastMoveAnimationEnabled] = useState(false);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragSnapshot | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const pendingDragRenderRef = useRef<{
    snapshot: DragSnapshot;
    targetSquare: string | null;
  } | null>(null);
  const [dragState, setDragState] = useState<DragSnapshot | null>(null);
  const [dragTargetSquare, setDragTargetSquare] = useState<string | null>(null);
  const suppressClickUntilRef = useRef(0);
  const suppressNextMoveAnimationRef = useRef(false);
  const moveInFlightRef = useRef(false);
  const previousGameOverRef = useRef(false);
  const [moveInFlight, setMoveInFlight] = useState(false);
  const activeTurn = turnProp ?? gameState.turn;

  // Warm the 12 piece PNGs as soon as a board mounts so the opening position
  // paints without waiting on per-image network discovery.
  useEffect(() => {
    for (const path of PIECE_IMAGE_PATHS) {
      preload(path, { as: "image" });
    }
  }, []);

  useEffect(() => {
    moveInFlightRef.current = false;
    setMoveInFlight(false);
    setSelectedSquare(null);
    setConfirmMove(null);
    setPendingMove(null);
    setShowPromotionModal(false);
    setLastMove(null);
    setLastMoveAnimationEnabled(false);
    suppressNextMoveAnimationRef.current = false;
    dragRef.current = null;
    suppressClickUntilRef.current = 0;
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    pendingDragRenderRef.current = null;
    setDragState(null);
    setDragTargetSquare(null);
  }, [gameId]);

  useEffect(() => {
    if (gameId || fen !== INITIAL_FEN || currentMoveCount !== 0) return;
    setSelectedSquare(null);
    setConfirmMove(null);
    setPendingMove(null);
    setShowPromotionModal(false);
    setLastMove(null);
    setLastMoveAnimationEnabled(false);
    suppressNextMoveAnimationRef.current = false;
    dragRef.current = null;
    suppressClickUntilRef.current = 0;
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    pendingDragRenderRef.current = null;
    setDragState(null);
    setDragTargetSquare(null);
  }, [currentMoveCount, fen, gameId]);

  // Initialize chess service when fen changes. Critical: this fires
  // whenever the `fen` prop changes — *including* when the parent echoes
  // back the same FEN we just produced from a local makeMove. Without
  // the guard below we'd rebuild the engine on every move and that
  // shows up as a one-frame "undo then redo" stutter as React commits
  // the redundant state. Skip the rebuild when our engine already
  // reflects the incoming FEN.
  useEffect(() => {
    if (chessService.getFen() === fen) {
      return;
    }
    const newChessService = new ChessClient(fen);
    setChessService(newChessService);
    const status = newChessService.getGameStatus();
    setGameState({
      fen: newChessService.getFen(),
      turn: newChessService.getCurrentTurn(),
      inCheck: status.isInCheck,
      gameOver: status.isCheckmate || status.isStalemate || status.isDraw,
      winner: status.isCheckmate
        ? status.turn === "white"
          ? "black"
          : "white"
        : status.isStalemate || status.isDraw
          ? "draw"
          : null,
      skipEndScreen: false, // Always show end screen for completed games
    });
    // chessService is intentionally excluded: the effect replaces it,
    // and including it would loop forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, viewMode]);

  // Play game-end sounds only when a live position TRANSITIONS into a draw.
  // The first effect run (mount) is always skipped so deep-linking straight
  // into a finished/drawn position never emits a spurious end sound.
  const gameEndArmedRef = useRef(false);
  useEffect(() => {
    const wasGameOver = previousGameOverRef.current;
    previousGameOverRef.current = gameState.gameOver;
    if (!gameEndArmedRef.current) {
      gameEndArmedRef.current = true;
      return;
    }
    if (
      gameState.gameOver &&
      !wasGameOver &&
      gameState.winner === "draw" &&
      !viewMode
    ) {
      soundManager.play("game-end");
    }
  }, [gameState.gameOver, gameState.winner, viewMode]);

  // Mirror externally-driven last move (bot / online opponent) into the
  // local lastMove state so the same slide-in animation that fires for our
  // own moves also fires for theirs. Parent only allocates a new object
  // when an actual new move comes in, so this fires once per move.
  useEffect(() => {
    if (!externalLastMove) return;
    setLastMove({ from: externalLastMove.from, to: externalLastMove.to });
    setLastMoveAnimationEnabled(true);
  }, [externalLastMove]);

  const isPromotionMove = useCallback(
    (from: string, to: string): boolean => {
      const piece = chessService.getPiece(from);
      if (!piece || piece.charAt(1) !== "P") return false;

      const toRank = parseInt(to.charAt(1));
      const isWhitePawn = piece.charAt(0) === "w";
      const reachesPromotionRank =
        (isWhitePawn && toRank === 8) || (!isWhitePawn && toRank === 1);

      if (!reachesPromotionRank) return false;
      return chessService.isMoveLegal(from, to, "q");
    },
    [chessService],
  );

  const squareFromPoint = useCallback(
    (clientX: number, clientY: number): string | null => {
      const board = boardRef.current;
      if (!board) return null;
      const rect = board.getBoundingClientRect();
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        return null;
      }

      const squareSize = rect.width / 8;
      const xIndex = Math.min(
        7,
        Math.max(0, Math.floor((clientX - rect.left) / squareSize)),
      );
      const yIndex = Math.min(
        7,
        Math.max(0, Math.floor((clientY - rect.top) / squareSize)),
      );
      const file = orientation === "black" ? 7 - xIndex : xIndex;
      const rank = orientation === "black" ? yIndex : 7 - yIndex;
      return coordsToSquare(file, rank);
    },
    [orientation],
  );

  const clampDragPointToBoard = useCallback(
    (clientX: number, clientY: number, squareSize?: number) => {
      const board = boardRef.current;
      if (!board) return { x: clientX, y: clientY };

      const rect = board.getBoundingClientRect();
      const visualHalf = ((squareSize ?? rect.width / 8) * 1.08) / 2;
      return {
        x: Math.min(
          rect.right - visualHalf,
          Math.max(rect.left + visualHalf, clientX),
        ),
        y: Math.min(
          rect.bottom - visualHalf,
          Math.max(rect.top + visualHalf, clientY),
        ),
      };
    },
    [],
  );

  const canStartPieceDrag = useCallback(
    (square: string, piece: string | null | undefined) => {
      if (disabled || moveInFlight || gameState.gameOver || confirmMove) {
        return false;
      }
      return Boolean(piece && piece[0] === activeTurn.charAt(0));
    },
    [activeTurn, confirmMove, disabled, gameState.gameOver, moveInFlight],
  );

  const selectedLegalTargets = useMemo(() => {
    if (!settings.highlightLegalMoves || !selectedSquare) return new Set<string>();
    return new Set(chessService.getPossibleMoves(selectedSquare));
  }, [chessService, selectedSquare, settings.highlightLegalMoves]);

  const dragLegalTargets = useMemo(() => {
    if (!settings.highlightLegalMoves || !dragState?.from) return new Set<string>();
    return new Set(chessService.getPossibleMoves(dragState.from));
  }, [chessService, dragState?.from, settings.highlightLegalMoves]);

  // Static per-square layout (square id, piece, light/dark parity, edge coord
  // labels). Memoized so the 64 getPiece() calls run only when the POSITION
  // changes — not on every drag rAF frame. A local makeMove mutates the engine
  // in place (same identity) but always bumps gameState.fen, so the fen is the
  // correct recompute trigger.
  const boardLayout = useMemo(() => {
    const isBlackView = orientation === "black";
    const rankRange = isBlackView
      ? [...Array(8).keys()]
      : [...Array(8).keys()].reverse();
    const fileRange = isBlackView
      ? [...Array(8).keys()].reverse()
      : [...Array(8).keys()];
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const cells: Array<{
      square: string;
      piece: string | null;
      isLight: boolean;
      rank: number;
      file: number;
      fileLabel: string | null;
      rankLabel: string | null;
    }> = [];
    for (const rank of rankRange) {
      for (const file of fileRange) {
        const square = coordsToSquare(file, rank);
        const isLight = (rank + file) % 2 === 1;
        const onBottomEdge = isBlackView ? rank === 7 : rank === 0;
        const onLeftEdge = isBlackView ? file === 7 : file === 0;
        cells.push({
          square,
          piece: chessService.getPiece(square),
          isLight,
          rank,
          file,
          fileLabel:
            settings.showCoordinates && onBottomEdge ? files[file] : null,
          rankLabel:
            settings.showCoordinates && onLeftEdge ? String(rank + 1) : null,
        });
      }
    }
    return cells;
    // gameState.fen is the necessary trigger: a local makeMove mutates the
    // ChessClient in place (stable identity), so the fen is what reliably
    // changes when the position does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.fen, chessService, orientation, settings.showCoordinates]);

  // Squares of pieces currently giving check, computed once per position
  // (previously rebuilt up to ~16 throwaway Chess instances on every render).
  const checkingSet = useMemo(() => {
    if (!gameState.inCheck) return new Set<string>();
    return new Set(chessService.getCheckingPieces());
    // gameState.fen recomputes the set when the position changes (see boardLayout).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.inCheck, gameState.fen, chessService]);

  const makeMove = useCallback(
    async (from: string, to: string, promotion?: string) => {
      if (gameId) {
        if (moveInFlightRef.current) {
          return { success: false, error: "Move already in progress" };
        }

        // First validate the move locally to prevent obvious errors
        const legal = chessService.isMoveLegal(from, to, promotion);
        if (!legal) {
          soundManager.play("illegal-move");
          return { success: false, error: "Invalid move" };
        }

        const prevFen = chessService.getFen();
        const expectedMoveCount = currentMoveCount;
        const clientMoveId = [
          gameId,
          expectedMoveCount + 1,
          from,
          to,
          promotion ?? "",
          Date.now(),
        ].join(":");
        const moveDetails = chessService.getMoveDetails(from, to, promotion);

        // Apply optimistic update
        const local = chessService.makeMove(from, to, promotion);
        if (!local.success) {
          soundManager.play("illegal-move");
          return { success: false, error: local.error || "Invalid move" };
        }
        moveInFlightRef.current = true;
        setMoveInFlight(true);

        const finishMoveInFlight = () => {
          moveInFlightRef.current = false;
          setMoveInFlight(false);
        };

        // Play move sound
        const status = chessService.getGameStatus();
        const moveData = {
          isCapture: Boolean(local.capturedPiece),
          isCastle: Boolean(
            moveDetails?.flags.includes("k") ||
              moveDetails?.flags.includes("q"),
          ),
          isPromotion: Boolean(promotion || moveDetails?.flags.includes("p")),
          isCheck: status.isInCheck && !status.isCheckmate,
          isCheckmate: status.isCheckmate,
          isIllegal: false,
        };
        soundManager.playMoveSound(moveData);

        // Update UI immediately
        const gameStatus: "active" | "checkmate" | "stalemate" | "draw" =
          status.isCheckmate
            ? "checkmate"
            : status.isStalemate
              ? "stalemate"
              : status.isDraw
                ? "draw"
                : "active";

        setGameState({
          fen: chessService.getFen(),
          turn: chessService.getCurrentTurn(),
          inCheck: status.isInCheck && !status.isCheckmate,
          gameOver: status.isCheckmate || status.isStalemate || status.isDraw,
          winner: status.isCheckmate
            ? status.turn === "white"
              ? "black"
              : "white"
            : status.isStalemate || status.isDraw
              ? "draw"
              : null,
          skipEndScreen: false,
        });
        setLastMove({ from, to });
        setLastMoveAnimationEnabled(!suppressNextMoveAnimationRef.current);
        suppressNextMoveAnimationRef.current = false;

        // Call parent callback immediately with optimistic state
        onMove?.({
          success: true,
          fen: chessService.getFen(),
          gameStatus,
          move: local.san,
          from,
          to,
          promotion,
          isCapture: moveData.isCapture,
          isCheck: moveData.isCheck,
          isCheckmate: moveData.isCheckmate,
          isCastling: moveData.isCastle,
          isPromotion: moveData.isPromotion,
          capturedPiece: local.capturedPiece,
        });

        // Persist to server in the background. On success we keep the
        // optimistic state. On rejection (or final network failure) we
        // revert to `prevFen` so the board never silently diverges from
        // what the server has.
        const revert = (reason: string) => {
          finishMoveInFlight();
          onMoveRejected?.({ previousFen: prevFen, from, to, reason });
          const revertChessService = new ChessClient(prevFen);
          setChessService(revertChessService);
          const revertStatus = revertChessService.getGameStatus();
          setGameState({
            fen: prevFen,
            turn: revertChessService.getCurrentTurn(),
            inCheck: revertStatus.isInCheck && !revertStatus.isCheckmate,
            gameOver:
              revertStatus.isCheckmate ||
              revertStatus.isStalemate ||
              revertStatus.isDraw,
            winner: revertStatus.isCheckmate
              ? revertStatus.turn === "white"
                ? "black"
                : "white"
              : revertStatus.isStalemate || revertStatus.isDraw
                ? "draw"
                : null,
            skipEndScreen: false,
          });
          soundManager.play("illegal-move");
        };

        const persistMove = async (retryCount = 0) => {
          try {
            const response = await fetch(`/api/games/${gameId}/moves`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              cache: "no-store",
              body: JSON.stringify({
                from,
                to,
                promotion,
                clientMoveId,
                expectedPly: expectedMoveCount + 1,
                prevFen,
              }),
            });

            const result = await response.json().catch(() => null);

            if (response.ok && result?.success) {
              // Move persisted. Trust the optimistic state we already
              // committed locally — the server's chess.js produces the
              // same FEN we did, so any byte-level divergence (halfmove
              // counter, etc.) is cosmetic and would only cause a
              // redundant setState + render (the original "undo then
              // redo" stutter). The parent's loadGameData / realtime
              // refresh is the authoritative reconciliation path.
              finishMoveInFlight();
              onMoveCommitted?.({
                fen: chessService.getFen(),
                from,
                to,
                promotion,
                clientMoveId,
                expectedPly: expectedMoveCount + 1,
              });
              return;
            }

            // Server rejection or transient error.
            if (!response.ok && response.status >= 500 && retryCount < 2) {
              setTimeout(
                () => persistMove(retryCount + 1),
                1000 * (retryCount + 1),
              );
              return;
            }
            revert(`server ${response.status}`);
          } catch (error) {
            if (retryCount >= 2) {
              revert(
                error instanceof Error
                  ? `network: ${error.message}`
                  : "network failure",
              );
              return;
            }
            setTimeout(
              () => persistMove(retryCount + 1),
              1000 * (retryCount + 1),
            );
          }
        };

        // Start the background save process
        persistMove();

        return { success: true };
      } else {
        // Local game (no gameId)
        const moveDetails = chessService.getMoveDetails(from, to, promotion);
        const result = chessService.makeMove(from, to, promotion);

        if (result.success) {
          const status = chessService.getGameStatus();
          const gameStatus: "active" | "checkmate" | "stalemate" | "draw" =
            status.isCheckmate
              ? "checkmate"
              : status.isStalemate
                ? "stalemate"
                : status.isDraw
                  ? "draw"
                  : "active";

          // Determine move characteristics for sound
          const moveData = {
            isCapture: Boolean(result.capturedPiece),
            isCastle: Boolean(
              moveDetails?.flags.includes("k") ||
                moveDetails?.flags.includes("q"),
            ),
            isPromotion: Boolean(promotion || moveDetails?.flags.includes("p")),
            isCheck: status.isInCheck && !status.isCheckmate,
            isCheckmate: status.isCheckmate,
            isIllegal: false,
          };

          // Play appropriate sound
          soundManager.playMoveSound(moveData);

          setGameState({
            fen: chessService.getFen(),
            turn: chessService.getCurrentTurn(),
            inCheck: status.isInCheck && !status.isCheckmate, // Don't show check if it's checkmate
            gameOver: status.isCheckmate || status.isStalemate || status.isDraw,
            winner: status.isCheckmate
              ? status.turn === "white"
                ? "black" // If it's white's turn and checkmate, black wins (white is checkmated)
                : "white" // If it's black's turn and checkmate, white wins (black is checkmated)
              : status.isStalemate || status.isDraw
                ? "draw"
                : null,
            skipEndScreen: false,
          });
          setLastMove({ from, to });
          setLastMoveAnimationEnabled(!suppressNextMoveAnimationRef.current);
          suppressNextMoveAnimationRef.current = false;

          if (onMove) {
            onMove({
              success: true,
              fen: chessService.getFen(),
              gameStatus,
              move: result.san,
              from,
              to,
              promotion,
              isCapture: moveData.isCapture,
              isCheck: moveData.isCheck,
              isCheckmate: moveData.isCheckmate,
              isCastling: moveData.isCastle,
              isPromotion: moveData.isPromotion,
              capturedPiece: result.capturedPiece,
            });
          }
        } else {
          // Play illegal move sound
          soundManager.play("illegal-move");
        }
        return result;
      }
    },
    [
      gameId,
      chessService,
      currentMoveCount,
      onMove,
      onMoveCommitted,
      onMoveRejected,
    ],
  );

  const handlePromotionSelect = async (piece: string) => {
    setShowPromotionModal(false);
    if (pendingMove) {
      if (settings.confirmMove) {
        setConfirmMove({ ...pendingMove, promotion: piece });
      } else {
        await makeMove(pendingMove.from, pendingMove.to, piece);
      }
      setPendingMove(null);
    }
    setSelectedSquare(null);
  };

  const handlePromotionCancel = () => {
    setShowPromotionModal(false);
    setPendingMove(null);
    setSelectedSquare(null);
    suppressNextMoveAnimationRef.current = false;
  };

  const queueOrMakeMove = useCallback(
    async (from: string, to: string, promotion?: string) => {
      if (settings.confirmMove) {
        setConfirmMove({ from, to, promotion });
        return { success: true };
      }
      return makeMove(from, to, promotion);
    },
    [makeMove, settings.confirmMove],
  );

  const confirmQueuedMove = useCallback(
    async (event?: React.MouseEvent<HTMLButtonElement>) => {
      event?.stopPropagation();
      if (!confirmMove) return;
      const move = confirmMove;
      setConfirmMove(null);
      await makeMove(move.from, move.to, move.promotion);
    },
    [confirmMove, makeMove],
  );

  const cancelQueuedMove = useCallback(() => {
    setConfirmMove(null);
    setPendingMove(null);
    setShowPromotionModal(false);
    setSelectedSquare(null);
    suppressNextMoveAnimationRef.current = false;
  }, []);

  const handleSquareClick = useCallback(
    async (square: string) => {
      if (Date.now() < suppressClickUntilRef.current) {
        return;
      }
      if (disabled || moveInFlight || gameState.gameOver) return;

      const piece = chessService.getPiece(square);

      if (confirmMove) {
        if (confirmMove.to === square) return;
        cancelQueuedMove();
        if (!(piece && piece[0] === activeTurn.charAt(0))) return;
      }

      if (selectedSquare) {
        if (selectedSquare === square) {
          // Deselect the same square
          setSelectedSquare(null);
        } else {
          // Check if this is a promotion move first
          if (isPromotionMove(selectedSquare, square)) {
            // Clear selection immediately for responsive UI
            setSelectedSquare(null);
            if (settings.autoPromoteToQueen) {
              await queueOrMakeMove(selectedSquare, square, "q");
            } else {
              setPendingMove({ from: selectedSquare, to: square });
              setShowPromotionModal(true);
            }
          } else {
            // Try to make a regular move
            const isLegalMove = chessService.isMoveLegal(selectedSquare, square);
            
            if (isLegalMove) {
              // Clear selection immediately for responsive UI
              setSelectedSquare(null);
              // Make a regular move (including en passant and castling)
              await queueOrMakeMove(selectedSquare, square);
            } else if (piece && piece[0] === activeTurn.charAt(0)) {
              // Select a new piece of the same color
              setSelectedSquare(square);
            } else {
              // Invalid move, play illegal move sound and deselect
              soundManager.play("illegal-move");
              setSelectedSquare(null);
            }
          }
        }
      } else if (piece && piece[0] === activeTurn.charAt(0)) {
        // Select a piece
        setSelectedSquare(square);
      }
    },
    [
      selectedSquare,
      activeTurn,
      gameState,
      chessService,
      disabled,
      moveInFlight,
      queueOrMakeMove,
      isPromotionMove,
      settings.autoPromoteToQueen,
      confirmMove,
      cancelQueuedMove,
    ],
  );

  const cancelDragFrame = useCallback(() => {
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    pendingDragRenderRef.current = null;
  }, []);

  const scheduleDragRender = useCallback(
    (snapshot: DragSnapshot, targetSquare: string | null) => {
      pendingDragRenderRef.current = { snapshot, targetSquare };
      if (dragFrameRef.current !== null) return;

      dragFrameRef.current = window.requestAnimationFrame(() => {
        dragFrameRef.current = null;
        const pending = pendingDragRenderRef.current;
        pendingDragRenderRef.current = null;
        if (!pending) return;

        setDragState(pending.snapshot);
        setDragTargetSquare((current) =>
          current === pending.targetSquare ? current : pending.targetSquare,
        );
      });
    },
    [],
  );

  const clearDrag = useCallback(() => {
    cancelDragFrame();
    dragRef.current = null;
    setDragState(null);
    setDragTargetSquare(null);
  }, [cancelDragFrame]);

  useEffect(() => cancelDragFrame, [cancelDragFrame]);

  const finishDragMove = useCallback(
    async (from: string, to: string | null) => {
      if (!to || from === to) {
        clearDrag();
        return;
      }

      if (isPromotionMove(from, to)) {
        setSelectedSquare(null);
        if (settings.autoPromoteToQueen) {
          suppressNextMoveAnimationRef.current = true;
          clearDrag();
          await queueOrMakeMove(from, to, "q");
          return;
        }
        setPendingMove({ from, to });
        suppressNextMoveAnimationRef.current = true;
        setShowPromotionModal(true);
        clearDrag();
        return;
      }

      if (chessService.isMoveLegal(from, to)) {
        setSelectedSquare(null);
        suppressNextMoveAnimationRef.current = true;
        await queueOrMakeMove(from, to);
        clearDrag();
        return;
      }

      soundManager.play("illegal-move");
      setSelectedSquare(null);
      clearDrag();
    },
    [
      chessService,
      clearDrag,
      isPromotionMove,
      queueOrMakeMove,
      settings.autoPromoteToQueen,
    ],
  );

  const handleSquarePointerDown = useCallback(
    (
      square: string,
      piece: string | null | undefined,
      event: React.PointerEvent<HTMLDivElement>,
    ) => {
      if (event.button !== 0 && event.pointerType === "mouse") return;
      if (!canStartPieceDrag(square, piece)) return;

      const board = boardRef.current;
      if (!board || !piece) return;
      const rect = board.getBoundingClientRect();
      const squareSize = rect.width / 8;

      const nextDrag: DragSnapshot = {
        pointerId: event.pointerId,
        from: square,
        piece,
        startX: event.clientX,
        startY: event.clientY,
        x: event.clientX,
        y: event.clientY,
        dragging: false,
        shouldClick: true,
        squareSize,
      };

      dragRef.current = nextDrag;
      setDragTargetSquare(square);
      event.currentTarget.setPointerCapture?.(event.pointerId);
      if (event.pointerType === "touch") {
        event.preventDefault();
      }
    },
    [canStartPieceDrag],
  );

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const current = dragRef.current;
      if (!current || current.pointerId !== event.pointerId) return;

      const deltaX = event.clientX - current.startX;
      const deltaY = event.clientY - current.startY;
      const dragging =
        current.dragging || Math.hypot(deltaX, deltaY) > 8;
      const clampedPoint = clampDragPointToBoard(
        event.clientX,
        event.clientY,
        current.squareSize,
      );

      const next: DragSnapshot = {
        ...current,
        x: clampedPoint.x,
        y: clampedPoint.y,
        dragging,
        shouldClick: current.shouldClick && !dragging,
      };
      dragRef.current = next;

      if (dragging) {
        scheduleDragRender(
          next,
          squareFromPoint(event.clientX, event.clientY),
        );
        event.preventDefault();
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      const current = dragRef.current;
      if (!current || current.pointerId !== event.pointerId) return;

      const wasDragging = current.dragging;
      const to = squareFromPoint(event.clientX, event.clientY);
      suppressClickUntilRef.current = wasDragging ? Date.now() + 120 : 0;

      if (wasDragging) {
        event.preventDefault();
        void finishDragMove(current.from, to);
      } else if (current.shouldClick) {
        clearDrag();
        void handleSquareClick(current.from);
        suppressClickUntilRef.current = Date.now() + 120;
      } else {
        clearDrag();
      }
    };

    const onPointerCancel = (event: PointerEvent) => {
      const current = dragRef.current;
      if (!current || current.pointerId !== event.pointerId) return;
      suppressClickUntilRef.current = 0;
      clearDrag();
    };

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp, { passive: false });
    window.addEventListener("pointercancel", onPointerCancel);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [
    clampDragPointToBoard,
    clearDrag,
    finishDragMove,
    handleSquareClick,
    scheduleDragRender,
    squareFromPoint,
  ]);

  const getSquareAnchorStyle = useCallback((square: string | null) => {
    const fallback: React.CSSProperties = {
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
    };
    if (!square || !boardRef.current) return fallback;
    const el = boardRef.current.querySelector<HTMLElement>(
      `[data-square="${square}"]`,
    );
    if (!el) return fallback;

    // Anchor the promotion picker over the destination square, clamped to the
    // viewport: prefer above the square, flip below when there is no room
    // (e.g. promoting on the back rank near the top edge on mobile), and keep
    // it horizontally on-screen.
    const rect = el.getBoundingClientRect();
    const POPOVER_W = 300;
    const POPOVER_H = 120;
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const left = Math.min(
      vw - POPOVER_W / 2 - margin,
      Math.max(POPOVER_W / 2 + margin, rect.left + rect.width / 2),
    );

    const aboveTop = rect.top - 10;
    if (aboveTop - POPOVER_H >= margin) {
      return { left, top: aboveTop, transform: "translate(-50%, -100%)" };
    }
    const belowTop = Math.min(rect.bottom + 10, vh - POPOVER_H - margin);
    return {
      left,
      top: Math.max(margin, belowTop),
      transform: "translate(-50%, 0)",
    };
  }, []);

  const renderBoard = () => {
    // Animation offset for the piece slide-in. Computed per render because it
    // depends on the latest move; the heavy layout + check computation is
    // memoized above. The sign flips for black orientation because the board
    // wrapper is rotated 180°, so the delta must be board-local.
    const isBlackView = orientation === "black";
    let animateTo: string | null = null;
    let animateOffset: { dx: string; dy: string } | null = null;
    if (lastMove && lastMoveAnimationEnabled) {
      const fromFile = lastMove.from.charCodeAt(0) - 97;
      const fromRank = parseInt(lastMove.from[1], 10) - 1;
      const toFile = lastMove.to.charCodeAt(0) - 97;
      const toRank = parseInt(lastMove.to[1], 10) - 1;
      const sign = isBlackView ? -1 : 1;
      const dxPct = (fromFile - toFile) * 100 * sign;
      const dyPct = (toRank - fromRank) * 100 * sign;
      animateTo = lastMove.to;
      animateOffset = { dx: `${dxPct}%`, dy: `${dyPct}%` };
    }

    return boardLayout.map(
      ({ square, piece, isLight, rank, file, fileLabel, rankLabel }) => {
        const isLastMove =
          settings.highlightLastMove &&
          lastMove &&
          (lastMove.from === square || lastMove.to === square);
        const animateFrom =
          animateTo === square && animateOffset ? animateOffset : null;
        const isCheck =
          gameState.inCheck &&
          piece &&
          ((piece === "wK" && activeTurn === "white") ||
            (piece === "bK" && activeTurn === "black"));

        return (
          <Square
            key={square}
            square={square}
            rank={rank}
            file={file}
            piece={piece}
            isLight={isLight}
            isSelected={selectedSquare === square}
            isHighlighted={selectedLegalTargets.has(square)}
            isLastMove={Boolean(isLastMove)}
            isCheck={Boolean(isCheck)}
            isCheckingPiece={gameState.inCheck && checkingSet.has(square)}
            onSquareClick={handleSquareClick}
            onSquarePointerDown={handleSquarePointerDown}
            fileLabel={fileLabel}
            rankLabel={rankLabel}
            animateFrom={animateFrom}
            isDraggingSource={
              Boolean(dragState?.dragging) && dragState?.from === square
            }
            isDragTarget={dragTargetSquare === square}
            isLegalDragTarget={dragLegalTargets.has(square)}
            isConfirmTarget={confirmMove?.to === square}
            onConfirmMove={confirmQueuedMove}
          />
        );
      },
    );
  };

  return (
    <div className="flex flex-col items-center">
      {/* Promotion picker */}
      <PromotionPopover
        show={showPromotionModal}
        color={activeTurn}
        targetSquare={pendingMove?.to ?? null}
        getAnchorStyle={getSquareAnchorStyle}
        onSelect={handlePromotionSelect}
        onCancel={handlePromotionCancel}
      />

      {/* Chess Board - orientation is controlled by render order. */}
      <div className="board-orient">
        <div
          ref={boardRef}
          className="chess-board-large"
          data-active-turn={activeTurn}
          data-selected-square={selectedSquare ?? ""}
          data-input-disabled={
            disabled || moveInFlight || gameState.gameOver ? "true" : "false"
          }
        >
          {renderBoard()}
        </div>
      </div>

      {dragState?.dragging && (
        <div
          className="pointer-events-none fixed left-0 top-0 z-[70] flex items-center justify-center"
          style={{
            width: dragState.squareSize,
            height: dragState.squareSize,
            transform: `translate3d(${dragState.x}px, ${dragState.y}px, 0) translate(-50%, -50%) scale(1.08)`,
            filter: "drop-shadow(0 12px 18px oklch(0 0 0 / 0.45))",
            willChange: "transform",
          }}
          aria-hidden="true"
        >
          <Piece piece={dragState.piece} />
        </div>
      )}

      {/* End-game modal. Suppressed when the parent (board page) renders its
       * own GameEndScreen driven by server-authoritative status. */}
      {gameState.gameOver && !gameState.skipEndScreen && !hideEndScreen && (
        <GameEndScreen
          status={gameState.winner === "draw" ? "draw" : "checkmate"}
          winner={gameState.winner as "white" | "black" | "draw" | null}
          gameId={gameId}
          onDismiss={() => setGameState({ ...gameState, skipEndScreen: true })}
        />
      )}
    </div>
  );
};

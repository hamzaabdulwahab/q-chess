"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Home, Target, Eye } from "lucide-react";
import { ChessClient } from "@/lib/chess-client";
import { soundManager } from "@/lib/sound-manager";
import { useChessTheme } from "@/lib/theme-context";

// Helper functions
const coordsToSquare = (file: number, rank: number): string => {
  return String.fromCharCode(97 + file) + (rank + 1);
};

interface ChessBoardProps {
  gameId?: number;
  fen?: string;
  onMove?: (result: {
    success: boolean;
    fen: string;
    gameStatus?: string;
    move?: string;
    from?: string;
    to?: string;
    promotion?: string;
  }) => void;
  disabled?: boolean;
  viewMode?: boolean;
  orientation?: "white" | "black";
  turn?: "white" | "black";
}

interface PieceProps {
  piece: string;
}

const Piece: React.FC<PieceProps> = ({ piece }) => {
  const [imageError, setImageError] = useState(false);
  
  // Map pieces to image filenames (PNG assets in public/pieces)
  // Inverted as requested: white pieces render black images and black pieces render white images
  const pieceImages: { [key: string]: string } = {
    wK: "black-king.png",
    wQ: "black-queen.png",
    wR: "black-rook.png",
    wB: "black-bishop.png",
    wN: "black-knight.png",
    wP: "black-pawn.png",
    bK: "white-king.png",
    bQ: "white-queen.png",
    bR: "white-rook.png",
    bB: "white-bishop.png",
    bN: "white-knight.png",
    bP: "white-pawn.png",
  };
  
  const pieceSymbols: { [key: string]: string } = {
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

  // Try different image path approaches
  const getImagePath = () => {
    const filename = pieceImages[piece];
    if (!filename) return null;
    
    // For production, try the direct path
    return `/pieces/${filename}`;
  };

  const imagePath = getImagePath();
  const color = piece[0] === "w" ? "text-white" : "text-gray-300";

  // Reset error state when piece changes
  useEffect(() => {
    setImageError(false);
  }, [piece]);

  // Handle image loading
  const handleImageLoad = () => {
    console.log(`✅ Successfully loaded piece image: ${imagePath}`);
    setImageError(false);
  };

  const handleImageError = () => {
    console.error(`❌ Failed to load piece image: ${imagePath}`);
    if (typeof window !== 'undefined') {
      console.error(`Full URL attempted: ${window.location.origin}${imagePath}`);
    }
    console.log(`💥 Using fallback symbol for ${piece}`);
    setImageError(true);
  };

  // Always try to load image first, fallback to symbol if error
  return (
    <div className="flex items-center justify-center w-full h-full select-none pointer-events-none">
      {!imageError && imagePath ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imagePath}
          alt={piece}
          width={97}
          height={97}
          className="chess-piece-image max-w-full max-h-full object-contain"
          data-color={piece[0] === "w" ? "white" : "black"}
          draggable={false}
          onError={handleImageError}
          onLoad={handleImageLoad}
        />
      ) : (
        <div
          className={`chess-piece-fallback font-bold text-4xl ${color}`}
        >
          {pieceSymbols[piece] || ""}
        </div>
      )}
    </div>
  );
};

interface SquareProps {
  rank: number;
  file: number;
  piece?: string | null;
  isLight: boolean;
  isSelected: boolean;
  isHighlighted: boolean;
  isLastMove: boolean;
  isCheck: boolean;
  isCheckingPiece: boolean;
  onClick: () => void;
  fileLabel?: string | null;
  rankLabel?: string | null;
}

const Square: React.FC<SquareProps> = ({
  piece,
  isLight,
  isSelected,
  isHighlighted,
  isLastMove,
  isCheck,
  isCheckingPiece,
  onClick,
  fileLabel,
  rankLabel,
}) => {
  const [hovered, setHovered] = useState(false);
  const { currentTheme } = useChessTheme();

  // Use theme colors instead of hardcoded ones
  const baseColor = isLight ? currentTheme.lightSquare : currentTheme.darkSquare;
  const hoverColor = isLight ? currentTheme.lightHover : currentTheme.darkHover;
  const coordColor = isLight ? currentTheme.lightCoord : currentTheme.darkCoord;

  const squareClasses = [
    "chess-square-large flex items-center justify-center relative cursor-pointer transition-colors duration-100",
  ].join(" ");

  const overlayNodes: React.ReactNode[] = [];
  if (isLastMove) {
    overlayNodes.push(
      <div
        key="last"
        className="absolute inset-0 pointer-events-none"
        style={{ backgroundColor: currentTheme.lastMoveHighlight }}
      />,
    );
  }
  if (isHighlighted) {
    overlayNodes.push(
      <div
        key="hl"
        className="absolute inset-0 pointer-events-none"
        style={{ backgroundColor: currentTheme.moveHighlight }}
      />,
    );
  }
  if (isCheck || isCheckingPiece) {
    overlayNodes.push(
      <div
        key="check"
        className="absolute inset-0 pointer-events-none"
        style={{ backgroundColor: currentTheme.checkHighlight }}
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

  return (
    <div
      className={squareClasses}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ backgroundColor: hovered ? hoverColor : baseColor }}
    >
      {overlayNodes}
      <div className="square-content w-full h-full flex items-center justify-center relative z-10">
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
    </div>
  );
};

// (Duplicate Square implementation removed above)

interface PromotionModalProps {
  show: boolean;
  color: "white" | "black";
  onSelect: (piece: string) => void;
  onCancel: () => void;
}

const PromotionModal: React.FC<PromotionModalProps> = ({
  show,
  color,
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl">
        <h3 className="text-lg font-bold mb-4 text-black">
          Choose promotion piece:
        </h3>
        <div className="flex gap-4">
          {pieces.map((p) => {
            const pieceCode = `${color[0]}${p.toUpperCase()}`;
            return (
              <button
                key={p}
                onClick={() => onSelect(p)}
                className="flex flex-col items-center p-3 border-2 border-gray-300 rounded hover:border-violet-500 hover:bg-violet-50 transition-colors"
              >
                <Piece piece={pieceCode} />
                <span className="text-sm text-black mt-2">{labels[p]}</span>
              </button>
            );
          })}
        </div>
        <button
          onClick={onCancel}
          className="mt-4 w-full bg-gray-700 text-white py-2 rounded hover:bg-gray-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export const ChessBoard: React.FC<ChessBoardProps> = ({
  gameId,
  fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  onMove,
  disabled = false,
  viewMode = false,
  orientation = "white",
}) => {
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
  } | null>(null);
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(
    null,
  );
  // Nudge removed in favor of true rotation

  // Initialize chess service when fen changes
  useEffect(() => {
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
      skipEndScreen: viewMode,
    });
    // Play game start sound for new games (starting position)
    if (
      fen === "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" &&
      !viewMode
    ) {
      soundManager.play("game-start");
    }
  }, [fen, viewMode]);

  // Play game end sounds for draws/stalemates
  useEffect(() => {
    if (gameState.gameOver && gameState.winner === "draw" && !viewMode) {
      soundManager.play("game-end");
    }
  }, [gameState.gameOver, gameState.winner, viewMode]);

  const makeMove = useCallback(
    async (from: string, to: string, promotion?: string) => {
      if (gameId) {
        // Optimistic UI: validate and apply locally first, then persist to server in background
        try {
          // Basic legality check to prevent obvious invalid moves
          const legal = chessService.isMoveLegal(from, to, promotion);
          if (!legal) {
            soundManager.play("illegal-move");
            return { success: false, error: "Invalid move" };
          }

          const prevFen = chessService.getFen();
          const prevPly = chessService.getHistory().length; // half-moves so far
          const expectedPly = prevPly + 1;
          const clientMoveId = `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 10)}`;
          const moveDetails = chessService.getMoveDetails(from, to, promotion);
          const local = chessService.makeMove(from, to, promotion);
          if (!local.success) {
            soundManager.play("illegal-move");
            return { success: false, error: local.error || "Invalid move" };
          }

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

          // Immediate UI update
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
          // Provide gameStatus in optimistic callback so parent can freeze clocks instantly
          const gameStatus: "active" | "checkmate" | "stalemate" | "draw" =
            status.isCheckmate
              ? "checkmate"
              : status.isStalemate
                ? "stalemate"
                : status.isDraw
                  ? "draw"
                  : "active";
          onMove?.({
            success: true,
            fen: chessService.getFen(),
            gameStatus,
            from,
            to,
            promotion,
          });

          // Persist to server in background and reconcile
          (async () => {
            try {
              const response = await fetch(`/api/games/${gameId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  from,
                  to,
                  promotion,
                  // idempotency and conflict detection
                  clientMoveId,
                  expectedPly,
                  prevFen,
                  san: local.san,
                }),
              });
              const result = await response.json().catch(() => null);
              if (response.ok && result && result.success) {
                // Only update if the server FEN is different from our current optimistic state
                const currentFen = chessService.getFen();
                if (result.fen !== currentFen) {
                  const newChessService = new ChessClient(result.fen);
                  setChessService(newChessService);
                  const s = newChessService.getGameStatus();
                  setGameState({
                    fen: result.fen,
                    turn: newChessService.getCurrentTurn(),
                    inCheck: s.isInCheck && result.gameStatus === "active",
                    gameOver: result.gameStatus !== "active",
                    winner: result.winner,
                    skipEndScreen: false,
                  });
                }
                // If FEN matches, our optimistic update was correct, no need to re-render
              } else if (response.ok && result && result.success === false) {
                // Server asserts move is illegal -> revert
                soundManager.play("illegal-move");
                const revert = new ChessClient(prevFen);
                setChessService(revert);
                const s = revert.getGameStatus();
                setGameState({
                  fen: prevFen,
                  turn: revert.getCurrentTurn(),
                  inCheck: s.isInCheck && !s.isCheckmate,
                  gameOver: s.isCheckmate || s.isStalemate || s.isDraw,
                  winner: s.isCheckmate
                    ? s.turn === "white"
                      ? "black"
                      : "white"
                    : s.isStalemate || s.isDraw
                      ? "draw"
                      : null,
                  skipEndScreen: false,
                });
              } else {
                // Non-OK response (401/409/500 etc.) -> keep optimistic state and queue for retry
                try {
                  if (gameId) {
                    const key = `queuedMoves:${gameId}`;
                    const raw = localStorage.getItem(key);
                    const queue: Array<{
                      from: string;
                      to: string;
                      promotion: string | null;
                      ts: number;
                      clientMoveId: string;
                      expectedPly: number;
                      prevFen: string;
                      san?: string;
                    }> = raw ? JSON.parse(raw) : [];
                    queue.push({
                      from,
                      to,
                      promotion: promotion ?? null,
                      ts: Date.now(),
                      clientMoveId,
                      expectedPly,
                      prevFen,
                      san: local.san,
                    });
                    localStorage.setItem(key, JSON.stringify(queue));
                    try {
                      window.dispatchEvent(
                        new CustomEvent("chess-queue-updated", {
                          detail: { gameId, length: queue.length },
                        }),
                      );
                    } catch {}
                  }
                } catch {}
              }
            } catch {
              // Network error -> keep optimistic state and queue move for later sync
              try {
                if (gameId) {
                  const key = `queuedMoves:${gameId}`;
                  const raw = localStorage.getItem(key);
                  const queue: Array<{
                    from: string;
                    to: string;
                    promotion: string | null;
                    ts: number;
                    clientMoveId: string;
                    expectedPly: number;
                    prevFen: string;
                    san?: string;
                  }> = raw ? JSON.parse(raw) : [];
                  queue.push({
                    from,
                    to,
                    promotion: promotion ?? null,
                    ts: Date.now(),
                    clientMoveId,
                    expectedPly,
                    prevFen,
                    san: local.san,
                  });
                  localStorage.setItem(key, JSON.stringify(queue));
                  // Notify listeners (Board page) that queue length changed
                  try {
                    window.dispatchEvent(
                      new CustomEvent("chess-queue-updated", {
                        detail: { gameId, length: queue.length },
                      }),
                    );
                  } catch {}
                }
              } catch {
                // ignore storage issues
              }
            }
          })();

          // Return immediately for snappy UX
          return { success: true };
        } catch {
          soundManager.play("illegal-move");
          return { success: false, error: "Unexpected error" };
        }
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
                ? "black" // If white is in checkmate, black wins
                : "white" // If black is in checkmate, white wins
              : status.isStalemate || status.isDraw
                ? "draw"
                : null,
            skipEndScreen: false,
          });
          setLastMove({ from, to });

          // Queue this move for later server sync when a gameId becomes available
          try {
            const key = "queuedMoves:offline";
            const raw = localStorage.getItem(key);
            const queue: Array<{
              from: string;
              to: string;
              promotion: string | null;
              ts: number;
              san?: string;
            }> = raw ? JSON.parse(raw) : [];
            queue.push({
              from,
              to,
              promotion: promotion ?? null,
              ts: Date.now(),
              san: result.san,
            });
            localStorage.setItem(key, JSON.stringify(queue));
            try {
              window.dispatchEvent(
                new CustomEvent("chess-queue-updated", {
                  detail: { gameId: "offline", length: queue.length },
                }),
              );
            } catch {}
          } catch {
            // ignore storage issues
          }

          if (onMove) {
            onMove({
              success: true,
              fen: chessService.getFen(),
              gameStatus,
              from,
              to,
              promotion,
            });
          }
        } else {
          // Play illegal move sound
          soundManager.play("illegal-move");
        }
        return result;
      }
    },
    [gameId, chessService, onMove],
  );

  const isPromotionMove = useCallback(
    (from: string, to: string): boolean => {
      const piece = chessService.getPiece(from);
      if (!piece || piece.charAt(1) !== "P") return false; // Not a pawn

      const toRank = parseInt(to.charAt(1));
      const isWhitePawn = piece.charAt(0) === "w";

      // Check if pawn reaches promotion rank
      const reachesPromotionRank = (isWhitePawn && toRank === 8) || (!isWhitePawn && toRank === 1);
      
      if (!reachesPromotionRank) return false;
      
      // Verify this is actually a legal move (including captures)
      // We need to check with queen promotion as default to validate the move is legal
      return chessService.isMoveLegal(from, to, "q");
    },
    [chessService],
  );

  const handlePromotionSelect = async (piece: string) => {
    setShowPromotionModal(false);
    if (pendingMove) {
      await makeMove(pendingMove.from, pendingMove.to, piece);
      setPendingMove(null);
    }
    setSelectedSquare(null);
  };

  const handlePromotionCancel = () => {
    setShowPromotionModal(false);
    setPendingMove(null);
    setSelectedSquare(null);
  };

  const handleSquareClick = useCallback(
    async (square: string) => {
      if (disabled || gameState.gameOver) return;

      const piece = chessService.getPiece(square);

      if (selectedSquare) {
        if (selectedSquare === square) {
          // Deselect the same square
          setSelectedSquare(null);
        } else {
          // Check if this is a promotion move first
          if (isPromotionMove(selectedSquare, square)) {
            // Clear selection immediately for responsive UI
            setSelectedSquare(null);
            setPendingMove({ from: selectedSquare, to: square });
            setShowPromotionModal(true);
          } else {
            // Try to make a regular move
            const isLegalMove = chessService.isMoveLegal(selectedSquare, square);
            
            if (isLegalMove) {
              // Clear selection immediately for responsive UI
              setSelectedSquare(null);
              // Make a regular move (including en passant and castling)
              await makeMove(selectedSquare, square);
            } else if (piece && piece[0] === gameState.turn.charAt(0)) {
              // Select a new piece of the same color
              setSelectedSquare(square);
            } else {
              // Invalid move, play illegal move sound and deselect
              soundManager.play("illegal-move");
              setSelectedSquare(null);
            }
          }
        }
      } else if (piece && piece[0] === gameState.turn.charAt(0)) {
        // Select a piece
        setSelectedSquare(square);
      }
    },
    [
      selectedSquare,
      gameState,
      chessService,
      disabled,
      makeMove,
      isPromotionMove,
    ],
  );

  const renderBoard = () => {
    const squares = [];
    // Detailed moves no longer needed for visual indicators
    // Keep iteration order constant (white-at-bottom); visual flip handled by wrapper
    const isBlackView = orientation === "black";
    const rankRange = [...Array(8).keys()].reverse();
    const fileRange = [...Array(8).keys()];
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];

    // Get checking pieces if in check
    const checkingPieces = gameState.inCheck ? chessService.getCheckingPieces() : [];

    for (const rank of rankRange) {
      for (const file of fileRange) {
        const square = coordsToSquare(file, rank);
        const piece = chessService.getPiece(square);
        const isLight = (rank + file) % 2 === 0;
        const isSelected = selectedSquare === square;
        
        // Remove move highlighting functionality - always false
        const isHighlighted = false;
        
        const isLastMove =
          lastMove && (lastMove.from === square || lastMove.to === square);
        
        // King is in check
        const isCheck =
          gameState.inCheck &&
          piece &&
          ((piece === "wK" && gameState.turn === "white") ||
            (piece === "bK" && gameState.turn === "black"));
        
        // Piece is giving check
        const isCheckingPiece = gameState.inCheck && checkingPieces.includes(square);

        // Coordinate labels (like chess.com):
        // Show file letter on the bottom edge, rank number on the left edge, based on viewer orientation
        const onBottomEdge = isBlackView ? rank === 7 : rank === 0;
        const onLeftEdge = isBlackView ? file === 7 : file === 0;
        const fileLabel = onBottomEdge
          ? files[isBlackView ? 7 - file : file]
          : null;
        const rankLabel = onLeftEdge
          ? String(isBlackView ? 8 - rank : rank + 1)
          : null;

        squares.push(
          <Square
            key={square}
            rank={rank}
            file={file}
            piece={piece}
            isLight={isLight}
            isSelected={isSelected}
            isHighlighted={isHighlighted}
            isLastMove={Boolean(isLastMove)}
            isCheck={Boolean(isCheck)}
            isCheckingPiece={Boolean(isCheckingPiece)}
            onClick={() => handleSquareClick(square)}
            fileLabel={fileLabel}
            rankLabel={rankLabel}
          />,
        );
      }
    }

    return squares;
  };

  return (
    <div className="flex flex-col items-center">
      {/* Promotion Modal */}
      <PromotionModal
        show={showPromotionModal}
        color={gameState.turn}
        onSelect={handlePromotionSelect}
        onCancel={handlePromotionCancel}
      />

      {/* Chess Board - visual rotation is controlled by orientation prop */}
      <div
        className={`board-orient ${
          orientation === "black" ? "board-rotated" : ""
        }`}
      >
        <div className="chess-board-large">{renderBoard()}</div>
      </div>

      {/* Status (end screens only). Render only when needed to avoid extra spacing */}
      {gameState.gameOver && !gameState.skipEndScreen ? (
        gameState.winner === "draw" ? (
          <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
            <div className="bg-gradient-to-br from-violet-950 via-violet-900 to-fuchsia-900 border-4 border-violet-700 rounded-2xl shadow-2xl p-12 max-w-2xl mx-4 text-center">
              <div className="text-6xl mb-6">🤝</div>
              <h1 className="text-4xl font-bold text-accent mb-4">
                HONORABLE DRAW
              </h1>
              <div className="w-24 h-1 bg-gradient-to-r from-violet-500 to-fuchsia-500 mx-auto mb-4"></div>
              <p className="text-xl text-violet-100 mb-6">
                A battle of equals, fought with honor and dignity
              </p>
              <div className="text-accent text-lg italic">
                &quot;In chess, as in life, respect is earned through skillful
                play&quot;
              </div>
              <div className="mt-8 flex gap-4 justify-center flex-wrap">
                <button
                  onClick={() => (window.location.href = "/")}
                  className="btn-accent text-black font-bold py-3 px-6 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 flex items-center gap-2"
                >
                  <Home className="h-5 w-5" />
                  <span>Home</span>
                </button>
                <button
                  onClick={() => (window.location.href = "/board")}
                  className="bg-violet-700 hover:bg-violet-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 flex items-center gap-2"
                >
                  <Target className="h-5 w-5" />
                  <span>New Game</span>
                </button>
                {gameId && (
                  <button
                    onClick={() => {
                      setGameState({ ...gameState, skipEndScreen: true });
                    }}
                    className="bg-fuchsia-700 hover:bg-fuchsia-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 flex items-center gap-2"
                  >
                    <Eye className="h-5 w-5" />
                    <span>View Game</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
            <div className="bg-gradient-to-br from-violet-950 via-violet-900 to-fuchsia-900 border-4 border-violet-700 rounded-3xl shadow-2xl p-16 max-w-3xl mx-4 text-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-4 left-4 text-6xl text-accent">
                  ♔
                </div>
                <div className="absolute top-4 right-4 text-6xl text-accent">
                  ♛
                </div>
                <div className="absolute bottom-4 left-4 text-6xl text-accent">
                  ♜
                </div>
                <div className="absolute bottom-4 right-4 text-6xl text-accent">
                  ♝
                </div>
              </div>
              <div className="relative z-10">
                <div className="text-8xl mb-8 animate-bounce">
                  {gameState.winner === "white" ? "♔" : "♛"}
                </div>
                <h1 className="text-6xl font-bold text-accent mb-6 tracking-wider">
                  VICTORY ROYAL
                </h1>
                <div className="w-32 h-2 bg-gradient-to-r from-violet-500 via-violet-400 to-fuchsia-500 mx-auto mb-6 rounded-full shadow-lg"></div>
                <div className="text-3xl text-violet-100 mb-6 font-semibold">
                  {gameState.winner?.charAt(0).toUpperCase()}
                  {gameState.winner?.slice(1)} Claims the Throne
                </div>
                <div className="bg-black bg-opacity-30 rounded-xl p-6 mb-6 border border-violet-700">
                  <p className="text-xl text-violet-100 italic leading-relaxed">
                    &quot;In the game of chess, the queen protects the king.
                    <br />
                    In the game of life, the king protects the queen.&quot;
                  </p>
                </div>
                <div className="flex justify-center items-center gap-4 text-lg text-accent">
                  <div className="w-16 h-1 bg-gradient-to-r from-transparent via-violet-500 to-transparent"></div>
                  <span className="font-semibold tracking-widest">Q-CHESS</span>
                  <div className="w-16 h-1 bg-gradient-to-r from-transparent via-violet-500 to-transparent"></div>
                </div>
                <div className="mt-8 text-accent text-lg">
                  A masterpiece of strategic brilliance
                </div>
                <div className="mt-10 flex gap-4 justify-center flex-wrap">
                  <button
                    onClick={() => (window.location.href = "/")}
                    className="btn-accent text-black font-bold py-3 px-8 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 flex items-center gap-2"
                  >
                    <Home className="h-5 w-5" />
                    <span>Home</span>
                  </button>
                  <button
                    onClick={() => (window.location.href = "/board")}
                    className="bg-violet-700 hover:bg-violet-600 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 flex items-center gap-2"
                  >
                    <Target className="h-5 w-5" />
                    <span>New Game</span>
                  </button>
                  {gameId && (
                    <button
                      onClick={() => {
                        setGameState({ ...gameState, skipEndScreen: true });
                      }}
                      className="bg-fuchsia-700 hover:bg-fuchsia-600 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 flex items-center gap-2"
                    >
                      <Eye className="h-5 w-5" />
                      <span>View Game</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      ) : null}
    </div>
  );
};

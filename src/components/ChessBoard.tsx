"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { ChessClient } from "@/lib/chess-client";
import { soundManager } from "@/lib/sound-manager";

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
  }) => void;
  disabled?: boolean;
  viewMode?: boolean;
}

interface PieceProps {
  piece: string;
}

const Piece: React.FC<PieceProps> = ({ piece }) => {
  // Map pieces to image filenames
  const pieceImages: { [key: string]: string } = {
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

  // Fallback Unicode symbols if images aren't available
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

  const imagePath = `/pieces/${pieceImages[piece]}`;
  const color = piece[0] === "w" ? "text-white" : "text-gray-300";

  return (
    <div className="flex items-center justify-center w-full h-full select-none pointer-events-none">
      <Image
        src={imagePath}
        alt={piece}
        width={97}
        height={97}
        className="chess-piece-image"
        onError={(e) => {
          // Fallback to Unicode symbols if image fails to load
          const target = e.target as HTMLImageElement;
          target.style.display = "none";
          const fallback = target.nextSibling as HTMLElement;
          if (fallback) fallback.style.display = "block";
        }}
      />
      <div
        className={`chess-piece-fallback font-bold ${color} hidden`}
        style={{ display: "none" }}
      >
        {pieceSymbols[piece] || ""}
      </div>
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
  isPossibleMove: boolean;
  isLastMove: boolean;
  isCheck: boolean;
  moveType?: "normal" | "capture" | "castle" | "enpassant" | "promotion";
  onClick: () => void;
}

const Square: React.FC<SquareProps> = ({
  piece,
  isLight,
  isSelected,
  isHighlighted,
  isPossibleMove,
  isLastMove,
  isCheck,
  moveType = "normal",
  onClick,
}) => {
  const squareClasses = [
    "chess-square-large flex items-center justify-center relative cursor-pointer transition-colors duration-150",
    isLight
      ? "bg-amber-100 hover:bg-amber-200"
      : "bg-amber-800 hover:bg-amber-700",
    isSelected ? "ring-4 ring-yellow-400 ring-inset" : "",
    isHighlighted ? "bg-yellow-300" : "",
    isLastMove ? "bg-yellow-200" : "",
    isCheck ? "bg-red-300" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const getMoveIndicator = () => {
    if (!isPossibleMove) return null;

    switch (moveType) {
      case "capture":
        return (
          <div className="w-full h-full border-4 border-red-500 rounded-full opacity-70 relative">
            <div className="absolute inset-2 border-2 border-red-400 rounded-full"></div>
          </div>
        );
      case "castle":
        return (
          <div className="w-6 h-6 bg-amber-600 rounded-full opacity-80 border-2 border-amber-400 flex items-center justify-center">
            <div className="text-white font-bold text-xs">♔</div>
          </div>
        );
      case "enpassant":
        return (
          <div className="w-6 h-6 bg-orange-600 rounded-full opacity-80 border-2 border-orange-400 flex items-center justify-center">
            <div className="text-white font-bold text-xs">EP</div>
          </div>
        );
      case "promotion":
        return (
          <div className="w-6 h-6 bg-yellow-600 rounded-lg opacity-80 border-2 border-yellow-400 flex items-center justify-center">
            <div className="text-white font-bold text-xs">♕</div>
          </div>
        );
      default:
        return (
          <div className="w-6 h-6 bg-amber-500 rounded-full opacity-75 shadow-md"></div>
        );
    }
  };

  return (
    <div className={squareClasses} onClick={onClick}>
      {piece && <Piece piece={piece} />}
      {isPossibleMove && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {getMoveIndicator()}
        </div>
      )}
    </div>
  );
};

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

  const pieces = ["q", "r", "b", "n"]; // queen, rook, bishop, knight
  const pieceNames = ["Queen", "Rook", "Bishop", "Knight"];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl">
        <h3 className="text-lg font-bold mb-4 text-black">
          Choose promotion piece:
        </h3>
        <div className="flex gap-4">
          {pieces.map((piece, index) => {
            const pieceCode = color[0] + piece.toUpperCase();
            return (
              <button
                key={piece}
                onClick={() => onSelect(piece)}
                className="flex flex-col items-center p-3 border-2 border-gray-300 rounded hover:border-blue-500 hover:bg-blue-50 transition-colors"
              >
                <Piece piece={pieceCode} />
                <span className="text-sm text-black mt-2">
                  {pieceNames[index]}
                </span>
              </button>
            );
          })}
        </div>
        <button
          onClick={onCancel}
          className="mt-4 w-full bg-gray-500 text-white py-2 rounded hover:bg-gray-600"
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
}) => {
  const [chessService, setChessService] = useState<ChessClient>(
    new ChessClient(fen)
  );
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<string[]>([]);
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
    null
  );

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
        try {
          const response = await fetch(`/api/games/${gameId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              from,
              to,
              promotion,
            }),
          });

          const result = await response.json();

          if (result.success) {
            const newChessService = new ChessClient(result.fen);
            setChessService(newChessService);
            const status = newChessService.getGameStatus();

            // Get move details before the move was made (using the previous chess service)
            const moveDetails = chessService.getMoveDetails(
              from,
              to,
              promotion
            );

            // Determine move characteristics for sound
            const moveData = {
              isCapture: Boolean(result.capturedPiece),
              isCastle: Boolean(
                moveDetails?.flags.includes("k") ||
                  moveDetails?.flags.includes("q")
              ),
              isPromotion: Boolean(
                promotion || moveDetails?.flags.includes("p")
              ),
              isCheck: status.isInCheck && result.gameStatus === "active",
              isCheckmate: result.gameStatus === "checkmate",
              isIllegal: false,
            };

            // Play appropriate sound
            soundManager.playMoveSound(moveData);

            setGameState({
              fen: result.fen,
              turn: newChessService.getCurrentTurn(),
              inCheck: status.isInCheck && result.gameStatus === "active", // Don't show check if game is over
              gameOver: result.gameStatus !== "active",
              winner: result.winner,
              skipEndScreen: false,
            });
            setLastMove({ from, to });

            if (onMove) {
              onMove(result);
            }
            return { success: true };
          } else {
            // Play illegal move sound
            soundManager.play("illegal-move");
            console.error("Move failed:", result.error);
            return { success: false, error: result.error };
          }
        } catch (error) {
          soundManager.play("illegal-move");
          console.error("Error making move:", error);
          return { success: false, error: "Network error" };
        }
      } else {
        // Local game (no gameId)
        const moveDetails = chessService.getMoveDetails(from, to, promotion);
        const result = chessService.makeMove(from, to, promotion);

        if (result.success) {
          const status = chessService.getGameStatus();

          // Determine move characteristics for sound
          const moveData = {
            isCapture: Boolean(result.capturedPiece),
            isCastle: Boolean(
              moveDetails?.flags.includes("k") ||
                moveDetails?.flags.includes("q")
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

          if (onMove) {
            onMove({ success: true, fen: chessService.getFen() });
          }
        } else {
          // Play illegal move sound
          soundManager.play("illegal-move");
        }
        return result;
      }
    },
    [gameId, chessService, onMove]
  );

  const isPromotionMove = useCallback(
    (from: string, to: string): boolean => {
      const piece = chessService.getPiece(from);
      if (!piece || piece.charAt(1) !== "P") return false; // Not a pawn

      const toRank = parseInt(to.charAt(1));
      const isWhitePawn = piece.charAt(0) === "w";

      return (isWhitePawn && toRank === 8) || (!isWhitePawn && toRank === 1);
    },
    [chessService]
  );

  const handlePromotionSelect = async (piece: string) => {
    setShowPromotionModal(false);
    if (pendingMove) {
      await makeMove(pendingMove.from, pendingMove.to, piece);
      setPendingMove(null);
    }
    setSelectedSquare(null);
    setPossibleMoves([]);
  };

  const handlePromotionCancel = () => {
    setShowPromotionModal(false);
    setPendingMove(null);
    setSelectedSquare(null);
    setPossibleMoves([]);
  };

  const handleSquareClick = useCallback(
    async (square: string) => {
      if (disabled || gameState.gameOver) return;

      const piece = chessService.getPiece(square);

      if (selectedSquare) {
        if (selectedSquare === square) {
          // Deselect the same square
          setSelectedSquare(null);
          setPossibleMoves([]);
        } else if (possibleMoves.includes(square)) {
          // Check if this is a promotion move
          if (isPromotionMove(selectedSquare, square)) {
            setPendingMove({ from: selectedSquare, to: square });
            setShowPromotionModal(true);
          } else {
            // Make a regular move (including en passant and castling)
            const result = await makeMove(selectedSquare, square);
            if (result.success) {
              setSelectedSquare(null);
              setPossibleMoves([]);
            }
          }
        } else if (piece && piece[0] === gameState.turn.charAt(0)) {
          // Select a new piece of the same color
          setSelectedSquare(square);
          setPossibleMoves(chessService.getPossibleMoves(square));
        } else {
          // Deselect if clicking on opponent's piece or empty square
          setSelectedSquare(null);
          setPossibleMoves([]);
        }
      } else if (piece && piece[0] === gameState.turn.charAt(0)) {
        // Select a piece
        setSelectedSquare(square);
        setPossibleMoves(chessService.getPossibleMoves(square));
      }
    },
    [
      selectedSquare,
      possibleMoves,
      gameState,
      chessService,
      disabled,
      makeMove,
      isPromotionMove,
    ]
  );

  const renderBoard = () => {
    const squares = [];
    const detailedMoves = chessService.getAllMovesDetailed();

    // Render from rank 8 to 1 (top to bottom)
    for (let rank = 7; rank >= 0; rank--) {
      for (let file = 0; file < 8; file++) {
        const square = coordsToSquare(file, rank);
        const piece = chessService.getPiece(square);
        const isLight = (rank + file) % 2 === 0;
        const isSelected = selectedSquare === square;
        const isPossibleMove = possibleMoves.includes(square);
        const isLastMove =
          lastMove && (lastMove.from === square || lastMove.to === square);
        const isCheck =
          gameState.inCheck &&
          piece &&
          ((piece === "wK" && gameState.turn === "white") ||
            (piece === "bK" && gameState.turn === "black"));

        // Determine move type for visual indicator
        let moveType:
          | "normal"
          | "capture"
          | "castle"
          | "enpassant"
          | "promotion" = "normal";
        if (isPossibleMove && selectedSquare) {
          const moveDetail = detailedMoves.find(
            (m) => m.from === selectedSquare && m.to === square
          );
          if (moveDetail) {
            if (moveDetail.flags.includes("c")) {
              moveType = "capture";
            } else if (
              moveDetail.flags.includes("k") ||
              moveDetail.flags.includes("q")
            ) {
              moveType = "castle";
            } else if (moveDetail.flags.includes("e")) {
              moveType = "enpassant";
            } else if (moveDetail.flags.includes("p")) {
              moveType = "promotion";
            }
          } else if (piece) {
            moveType = "capture";
          }
        }

        squares.push(
          <Square
            key={square}
            rank={rank}
            file={file}
            piece={piece}
            isLight={isLight}
            isSelected={isSelected}
            isHighlighted={false}
            isPossibleMove={isPossibleMove}
            isLastMove={Boolean(isLastMove)}
            isCheck={Boolean(isCheck)}
            moveType={moveType}
            onClick={() => handleSquareClick(square)}
          />
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

      {/* Chess Board - No borders or coordinates */}
      <div className="chess-board-large">{renderBoard()}</div>

      {/* Status */}
      <div className="mt-8 text-center">
        <div className="text-2xl font-bold text-white mb-3">
          {gameState.gameOver && !gameState.skipEndScreen ? (
            gameState.winner === "draw" ? (
              <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
                <div className="bg-gradient-to-br from-amber-900 via-yellow-900 to-orange-900 border-4 border-amber-500 rounded-2xl shadow-2xl p-12 max-w-2xl mx-4 text-center">
                  <div className="text-6xl mb-6">🤝</div>
                  <h1 className="text-4xl font-bold text-amber-200 mb-4">
                    HONORABLE DRAW
                  </h1>
                  <div className="w-24 h-1 bg-gradient-to-r from-amber-500 to-orange-500 mx-auto mb-4"></div>
                  <p className="text-xl text-amber-100 mb-6">
                    A battle of equals, fought with honor and dignity
                  </p>
                  <div className="text-amber-300 text-lg italic">
                    &quot;In chess, as in life, respect is earned through
                    skillful play&quot;
                  </div>

                  {/* Action buttons */}
                  <div className="mt-8 flex gap-4 justify-center flex-wrap">
                    <button
                      onClick={() => (window.location.href = "/")}
                      className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105"
                    >
                      🏠 Home
                    </button>
                    <button
                      onClick={() => (window.location.href = "/board")}
                      className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105"
                    >
                      🎯 New Game
                    </button>
                    {gameId && (
                      <button
                        onClick={() => {
                          setGameState({ ...gameState, skipEndScreen: true });
                        }}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105"
                      >
                        👁️ View Game
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
                <div className="bg-gradient-to-br from-amber-900 via-yellow-800 to-orange-900 border-4 border-amber-400 rounded-3xl shadow-2xl p-16 max-w-3xl mx-4 text-center relative overflow-hidden">
                  {/* Royal background pattern */}
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-4 left-4 text-6xl text-amber-300">
                      ♔
                    </div>
                    <div className="absolute top-4 right-4 text-6xl text-amber-300">
                      ♛
                    </div>
                    <div className="absolute bottom-4 left-4 text-6xl text-amber-300">
                      ♜
                    </div>
                    <div className="absolute bottom-4 right-4 text-6xl text-amber-300">
                      ♝
                    </div>
                  </div>

                  {/* Main content */}
                  <div className="relative z-10">
                    <div className="text-8xl mb-8 animate-bounce">
                      {gameState.winner === "white" ? "♔" : "♛"}
                    </div>
                    <h1 className="text-6xl font-bold text-amber-200 mb-6 tracking-wider">
                      VICTORY ROYAL
                    </h1>
                    <div className="w-32 h-2 bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500 mx-auto mb-6 rounded-full shadow-lg"></div>

                    <div className="text-3xl text-amber-100 mb-6 font-semibold">
                      {gameState.winner?.charAt(0).toUpperCase()}
                      {gameState.winner?.slice(1)} Claims the Throne
                    </div>

                    <div className="bg-black bg-opacity-30 rounded-xl p-6 mb-6 border border-amber-500">
                      <p className="text-xl text-amber-200 italic leading-relaxed">
                        &quot;In the game of chess, the queen protects the king.
                        <br />
                        In the game of life, the king protects the queen.&quot;
                      </p>
                    </div>

                    <div className="flex justify-center items-center gap-4 text-lg text-amber-300">
                      <div className="w-16 h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent"></div>
                      <span className="font-semibold tracking-widest">
                        FOR MY QUEEN
                      </span>
                      <div className="w-16 h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent"></div>
                    </div>

                    <div className="mt-8 text-amber-400 text-lg">
                      A masterpiece of strategic brilliance
                    </div>

                    {/* Action buttons */}
                    <div className="mt-10 flex gap-4 justify-center flex-wrap">
                      <button
                        onClick={() => (window.location.href = "/")}
                        className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105"
                      >
                        🏠 Home
                      </button>
                      <button
                        onClick={() => (window.location.href = "/board")}
                        className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105"
                      >
                        🎯 New Game
                      </button>
                      {gameId && (
                        <button
                          onClick={() => {
                            setGameState({ ...gameState, skipEndScreen: true });
                          }}
                          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105"
                        >
                          👁️ View Game
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          ) : (
            <>
              <span
                className={
                  gameState.turn === "white" ? "text-white" : "text-gray-300"
                }
              >
                {gameState.turn.charAt(0).toUpperCase()}
                {gameState.turn.slice(1)} to move
              </span>
              {gameState.inCheck && !gameState.gameOver && (
                <div className="text-red-400 mt-2 font-bold animate-pulse">
                  ⚠️ CHECK! ⚠️
                </div>
              )}
              {gameState.gameOver &&
                gameState.winner &&
                gameState.winner !== "draw" && (
                  <div className="text-red-600 mt-2 font-bold animate-pulse text-xl">
                    🏆 CHECKMATE! {gameState.winner.toUpperCase()} WINS! 🏆
                  </div>
                )}
            </>
          )}
        </div>

        {/* Game status indicators */}
        {!gameState.gameOver && (
          <div className="flex justify-center items-center gap-6 text-lg text-gray-300">
            <div className="flex items-center gap-3">
              <div
                className={`w-4 h-4 rounded-full ${
                  gameState.turn === "white"
                    ? "bg-white shadow-lg"
                    : "bg-gray-500"
                }`}
              ></div>
              <span
                className={
                  gameState.turn === "white" ? "text-white font-semibold" : ""
                }
              >
                White
              </span>
            </div>
            <div className="text-gray-600">•</div>
            <div className="flex items-center gap-3">
              <div
                className={`w-4 h-4 rounded-full ${
                  gameState.turn === "black"
                    ? "bg-gray-800 border-2 border-white shadow-lg"
                    : "bg-gray-600"
                }`}
              ></div>
              <span
                className={
                  gameState.turn === "black" ? "text-white font-semibold" : ""
                }
              >
                Black
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

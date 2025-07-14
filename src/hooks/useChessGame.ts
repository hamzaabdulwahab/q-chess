// Hook for managing chess game state with Supabase
import { useState, useEffect, useCallback } from 'react';
import { ChessService } from '@/lib/chess-service';

export function useChessGame(gameId?: string) {
  const [chessService, setChessService] = useState<ChessService | null>(null);
  const [gameState, setGameState] = useState({
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    turn: 'white' as 'white' | 'black',
    status: 'active',
    moveHistory: [] as string[],
    capturedPieces: { white: [] as string[], black: [] as string[] },
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get captured pieces
  const getCapturedPieces = useCallback((service: ChessService) => {
    const history = service.chess.history({ verbose: true });
    const captured = { white: [] as string[], black: [] as string[] };

    for (const move of history) {
      if (move.captured) {
        if (move.color === 'w') {
          captured.white.push(move.captured);
        } else {
          captured.black.push(move.captured);
        }
      }
    }

    return captured;
  }, []);

  // Update game state from chess service
  const updateGameState = useCallback((service: ChessService) => {
    setGameState({
      fen: service.getFen(),
      turn: service.getCurrentTurn(),
      status: service.chess.isGameOver() ? 'ended' : 'active',
      moveHistory: service.getHistory(),
      capturedPieces: getCapturedPieces(service),
    });
  }, [getCapturedPieces]);

  // Load existing game
  const loadGame = useCallback(async (id: string, service: ChessService) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await service.loadGame(id);
      if (result.success) {
        updateGameState(service);
      } else {
        setError(result.error || 'Failed to load game');
      }
    } catch {
      setError('Failed to load game');
    } finally {
      setIsLoading(false);
    }
  }, [updateGameState]);

  // Initialize chess service
  useEffect(() => {
    const service = new ChessService();
    setChessService(service);
    
    if (gameId) {
      loadGame(gameId, service);
    }
  }, [gameId, loadGame]);

  // Create new game
  const createGame = async (whitePlayerId?: string, blackPlayerId?: string) => {
    if (!chessService) return null;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await chessService.createGame(whitePlayerId, blackPlayerId);
      if (result.success) {
        updateGameState(chessService);
        return result.gameId;
      } else {
        setError(result.error || 'Failed to create game');
        return null;
      }
    } catch {
      setError('Failed to create game');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Make a move
  const makeMove = async (from: string, to: string, promotion?: string) => {
    if (!chessService) return false;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await chessService.makeMove(from, to, promotion);
      if (result.success) {
        // Save to database
        await chessService.saveGame();
        const moveHistory = chessService.getHistory();
        await chessService.saveMove(result.san!, moveHistory.length);
        
        updateGameState(chessService);
        return true;
      } else {
        setError(result.error || 'Invalid move');
        return false;
      }
    } catch {
      setError('Failed to make move');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Subscribe to real-time updates
  useEffect(() => {
    if (!chessService || !gameId) return;

    const unsubscribe = chessService.subscribeToGame(gameId, (payload) => {
      // Update game state when remote changes occur
      if (payload.new) {
        chessService.chess.load(payload.new.fen as string);
        updateGameState(chessService);
      }
    });

    return unsubscribe;
  }, [chessService, gameId, updateGameState]);

  return {
    gameState,
    isLoading,
    error,
    createGame,
    makeMove,
    getPossibleMoves: (square: string) => chessService?.getPossibleMoves(square) || [],
    resetGame: () => {
      chessService?.reset();
      updateGameState(chessService!);
    },
  };
}

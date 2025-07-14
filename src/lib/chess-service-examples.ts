// Example usage of ChessService with Supabase integration

import { ChessService } from '@/lib/chess-service';

// Example 1: Create a new game and save it to database
async function createNewGame() {
  const chessService = new ChessService();
  
  // Create a new game in the database
  const result = await chessService.createGame('player1-id', 'player2-id');
  
  if (result.success) {
    console.log('Game created with ID:', result.gameId);
    return result.gameId;
  } else {
    console.error('Failed to create game:', result.error);
    return null;
  }
}

// Example 2: Load an existing game from database
async function loadExistingGame(gameId: string) {
  const chessService = new ChessService();
  
  const result = await chessService.loadGame(gameId);
  
  if (result.success) {
    console.log('Game loaded successfully');
    console.log('Current FEN:', chessService.getFen());
    console.log('Current turn:', chessService.getCurrentTurn());
    return chessService;
  } else {
    console.error('Failed to load game:', result.error);
    return null;
  }
}

// Example 3: Make a move and save it
async function makeAndSaveMove(chessService: ChessService, from: string, to: string) {
  const moveResult = await chessService.makeMove(from, to);
  
  if (moveResult.success) {
    console.log('Move made:', moveResult.san);
    
    // Save the updated game state
    await chessService.saveGame();
    
    // Save the move to moves table
    const moveHistory = chessService.getHistory();
    await chessService.saveMove(moveResult.san!, moveHistory.length);
    
    return moveResult;
  } else {
    console.error('Invalid move:', moveResult.error);
    return null;
  }
}

// Example 4: Subscribe to real-time game updates
function subscribeToGameUpdates(gameId: string) {
  const chessService = new ChessService();
  
  // Subscribe to game state changes
  const unsubscribeGame = chessService.subscribeToGame(gameId, (payload) => {
    console.log('Game updated:', payload);
    // Update UI with new game state
    // payload.new contains the updated game data
  });
  
  // Subscribe to new moves
  const unsubscribeMoves = chessService.subscribeToMoves(gameId, (payload) => {
    console.log('New move:', payload);
    // Update UI with new move
    // payload.new contains the new move data
  });
  
  // Return cleanup function
  return () => {
    unsubscribeGame();
    unsubscribeMoves();
  };
}

// Example 5: Get all games for a player
async function getPlayerGames(playerId: string) {
  const chessService = new ChessService();
  
  const result = await chessService.getPlayerGames(playerId);
  
  if (result.success) {
    console.log('Player games:', result.games);
    return result.games;
  } else {
    console.error('Failed to get player games:', result.error);
    return null;
  }
}

// Example 6: Complete game flow
async function completeGameExample() {
  // Create a new game
  const gameId = await createNewGame();
  if (!gameId) return;
  
  // Load the game
  const chessService = await loadExistingGame(gameId);
  if (!chessService) return;
  
  // Set up real-time subscriptions
  const unsubscribe = subscribeToGameUpdates(gameId);
  
  // Make some moves
  await makeAndSaveMove(chessService, 'e2', 'e4');
  await makeAndSaveMove(chessService, 'e7', 'e5');
  await makeAndSaveMove(chessService, 'g1', 'f3');
  
  // Get game moves
  const movesResult = await chessService.getGameMoves(gameId);
  if (movesResult.success) {
    console.log('Game moves:', movesResult.moves);
  }
  
  // Clean up subscriptions when done
  // unsubscribe();
}

export {
  createNewGame,
  loadExistingGame,
  makeAndSaveMove,
  subscribeToGameUpdates,
  getPlayerGames,
  completeGameExample
};

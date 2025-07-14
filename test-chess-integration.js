// Quick test of the ChessService integration
import { ChessService } from './src/lib/chess-service.js';

async function quickTest() {
  console.log('🎮 Testing Chess Service with Supabase...');
  
  try {
    // Create a new chess service instance
    const chessService = new ChessService();
    
    // Test 1: Create a new game
    console.log('1️⃣ Creating new game...');
    const createResult = await chessService.createGame();
    
    if (createResult.success) {
      console.log('✅ Game created with ID:', createResult.gameId);
      
      // Test 2: Make a move
      console.log('2️⃣ Making first move (e2-e4)...');
      const moveResult = await chessService.makeMove('e2', 'e4');
      
      if (moveResult.success) {
        console.log('✅ Move successful:', moveResult.san);
        
        // Test 3: Save the game
        console.log('3️⃣ Saving game state...');
        const saveResult = await chessService.saveGame();
        
        if (saveResult.success) {
          console.log('✅ Game saved successfully!');
          
          // Test 4: Save the move
          console.log('4️⃣ Saving move to database...');
          const moveHistory = chessService.getHistory();
          const saveMoveResult = await chessService.saveMove(moveResult.san, moveHistory.length);
          
          if (saveMoveResult.success) {
            console.log('✅ Move saved successfully!');
            console.log('🎯 Current FEN:', chessService.getFen());
            console.log('🎯 Move history:', moveHistory);
            
            // Test 5: Load the game
            console.log('5️⃣ Testing game loading...');
            const newChessService = new ChessService();
            const loadResult = await newChessService.loadGame(createResult.gameId);
            
            if (loadResult.success) {
              console.log('✅ Game loaded successfully!');
              console.log('🎯 Loaded FEN:', newChessService.getFen());
              console.log('🎯 Loaded history:', newChessService.getHistory());
              
              console.log('\n🚀 ALL TESTS PASSED! Your chess app is fully integrated with Supabase!');
            } else {
              console.error('❌ Game loading failed:', loadResult.error);
            }
          } else {
            console.error('❌ Move saving failed:', saveMoveResult.error);
          }
        } else {
          console.error('❌ Game saving failed:', saveResult.error);
        }
      } else {
        console.error('❌ Move failed:', moveResult.error);
      }
    } else {
      console.error('❌ Game creation failed:', createResult.error);
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

quickTest();

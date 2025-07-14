// Test Supabase connection
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://muxrenbatuepxdhvbcme.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11eHJlbmJhdHVlcHhkaHZiY21lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDkxMTYsImV4cCI6MjA2ODA4NTExNn0.GeQPW7DBzWN44DJ_YTQ_ycp30i20xadgHz7clsqIqWw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  try {
    console.log('🧪 Testing Supabase connection...');
    
    // Test 1: Check if games table exists
    const { error: gamesError } = await supabase
      .from('games')
      .select('count')
      .limit(1);
    
    if (gamesError) {
      console.error('❌ Games table error:', gamesError.message);
      return false;
    }
    
    // Test 2: Check if moves table exists
    const { error: movesError } = await supabase
      .from('moves')
      .select('count')
      .limit(1);
    
    if (movesError) {
      console.error('❌ Moves table error:', movesError.message);
      return false;
    }
    
    // Test 3: Try to insert a test game
    const { data: insertData, error: insertError } = await supabase
      .from('games')
      .insert([
        {
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          status: 'active'
        }
      ])
      .select()
      .single();
    
    if (insertError) {
      console.error('❌ Insert test failed:', insertError.message);
      return false;
    }
    
    console.log('✅ Database connection successful!');
    console.log('✅ Games table: Working');
    console.log('✅ Moves table: Working');
    console.log('✅ Insert permissions: Working');
    console.log('🎮 Test game created with ID:', insertData.id);
    
    // Clean up test data
    await supabase.from('games').delete().eq('id', insertData.id);
    console.log('🧹 Test data cleaned up');
    
    return true;
    
  } catch (err) {
    console.error('❌ Connection test failed:', err.message);
    return false;
  }
}

testConnection().then(success => {
  if (success) {
    console.log('\n🚀 Your Supabase setup is complete!');
    console.log('👉 Next step: Run `bun run dev` to start your chess app');
  } else {
    console.log('\n❌ Setup needs attention. Check the errors above.');
  }
  process.exit(success ? 0 : 1);
});

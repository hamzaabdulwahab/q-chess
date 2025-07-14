-- Create games table
CREATE TABLE IF NOT EXISTS games (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  white_player_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  black_player_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  fen TEXT DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  pgn TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'checkmate', 'stalemate', 'draw', 'resigned', 'timeout')),
  winner TEXT CHECK (winner IN ('white', 'black', 'draw')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create moves table
CREATE TABLE IF NOT EXISTS moves (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  move_number INTEGER NOT NULL,
  san TEXT NOT NULL,
  fen_after TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_games_white_player ON games(white_player_id);
CREATE INDEX IF NOT EXISTS idx_games_black_player ON games(black_player_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at);
CREATE INDEX IF NOT EXISTS idx_moves_game_id ON moves(game_id);
CREATE INDEX IF NOT EXISTS idx_moves_move_number ON moves(move_number);

-- Enable Row Level Security (RLS)
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE moves ENABLE ROW LEVEL SECURITY;

-- Create policies for games table
CREATE POLICY "Users can view games they are part of" ON games
  FOR SELECT USING (
    auth.uid() = white_player_id OR 
    auth.uid() = black_player_id OR
    auth.uid() IS NULL  -- Allow anonymous users to view games
  );

CREATE POLICY "Users can insert new games" ON games
  FOR INSERT WITH CHECK (
    auth.uid() = white_player_id OR 
    auth.uid() = black_player_id OR
    auth.uid() IS NULL  -- Allow anonymous users to create games
  );

CREATE POLICY "Users can update games they are part of" ON games
  FOR UPDATE USING (
    auth.uid() = white_player_id OR 
    auth.uid() = black_player_id OR
    auth.uid() IS NULL  -- Allow anonymous users to update games
  );

-- Create policies for moves table
CREATE POLICY "Users can view moves for games they are part of" ON moves
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM games 
      WHERE games.id = moves.game_id 
      AND (
        auth.uid() = games.white_player_id OR 
        auth.uid() = games.black_player_id OR
        auth.uid() IS NULL  -- Allow anonymous users to view moves
      )
    )
  );

CREATE POLICY "Users can insert moves for games they are part of" ON moves
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM games 
      WHERE games.id = moves.game_id 
      AND (
        auth.uid() = games.white_player_id OR 
        auth.uid() = games.black_player_id OR
        auth.uid() IS NULL  -- Allow anonymous users to insert moves
      )
    )
  );

-- Enable real-time subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE games;
ALTER PUBLICATION supabase_realtime ADD TABLE moves;

-- Create a function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_games_updated_at 
  BEFORE UPDATE ON games 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

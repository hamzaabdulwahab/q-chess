-- Migration: Add user ownership to games
-- This fixes the privacy issue where all users see all games

-- 1. Add user_id column to games table
ALTER TABLE public.games 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. For existing games without a user_id, we'll set them to null
-- In production, you might want to assign them to a specific user or delete them

-- 3. Update RLS policies to enforce user ownership
-- Drop existing policies
DROP POLICY IF EXISTS games_select_public ON public.games;
DROP POLICY IF EXISTS games_write_authenticated ON public.games;

-- Create new policies that respect user ownership
CREATE POLICY games_select_own
  ON public.games FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY games_insert_own
  ON public.games FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY games_update_own
  ON public.games FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY games_delete_own
  ON public.games FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. Add index for better performance
CREATE INDEX IF NOT EXISTS idx_games_user_id ON public.games(user_id);

-- 5. Update moves table policies to inherit from games ownership
-- Drop existing policies
DROP POLICY IF EXISTS moves_select_public ON public.moves;
DROP POLICY IF EXISTS moves_write_authenticated ON public.moves;

-- Create new policies that check if user owns the game
CREATE POLICY moves_select_own_game
  ON public.moves FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.games 
      WHERE games.id = moves.game_id 
      AND games.user_id = auth.uid()
    )
  );

CREATE POLICY moves_insert_own_game
  ON public.moves FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.games 
      WHERE games.id = moves.game_id 
      AND games.user_id = auth.uid()
    )
  );

CREATE POLICY moves_update_own_game
  ON public.moves FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.games 
      WHERE games.id = moves.game_id 
      AND games.user_id = auth.uid()
    )
  );

CREATE POLICY moves_delete_own_game
  ON public.moves FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.games 
      WHERE games.id = moves.game_id 
      AND games.user_id = auth.uid()
    )
  );
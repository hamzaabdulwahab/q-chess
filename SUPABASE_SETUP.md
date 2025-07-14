# Supabase Setup Instructions

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Create a new project
3. Wait for the project to be ready (usually takes 1-2 minutes)

## 2. Get Your Supabase Credentials

1. In your Supabase dashboard, go to Settings > API
2. Copy the following values:
   - `Project URL` (this is your `NEXT_PUBLIC_SUPABASE_URL`)
   - `anon public` key (this is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

## 3. Set Up Environment Variables

1. Create a `.env.local` file in your project root:
   ```bash
   cp .env.local.example .env.local
   ```

2. Edit `.env.local` and add your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

## 4. Set Up Database Schema

1. In your Supabase dashboard, go to SQL Editor
2. Copy the contents of `supabase-schema.sql` 
3. Paste it into the SQL Editor and run it
4. This will create the necessary tables, indexes, and policies

## 5. Install Dependencies

```bash
bun install
```

## 6. Run the Application

```bash
bun run dev
```

## Database Schema

The application uses two main tables:

### `games` table
- `id`: UUID primary key
- `white_player_id`: UUID reference to auth.users (nullable)
- `black_player_id`: UUID reference to auth.users (nullable)
- `fen`: TEXT - current board position
- `pgn`: TEXT - game notation
- `status`: TEXT - game status (active, checkmate, stalemate, draw, resigned, timeout)
- `winner`: TEXT - game winner (white, black, draw)
- `created_at`: TIMESTAMP
- `updated_at`: TIMESTAMP

### `moves` table
- `id`: UUID primary key
- `game_id`: UUID reference to games table
- `move_number`: INTEGER - sequential move number
- `san`: TEXT - move in standard algebraic notation
- `fen_after`: TEXT - board position after the move
- `created_at`: TIMESTAMP

## Real-time Features

The application supports real-time updates using Supabase's real-time subscriptions:

- Game state changes are broadcast to all connected clients
- Move updates are received instantly
- Perfect for multiplayer chess games

## Usage Example

```typescript
// Create a new game
const chessService = new ChessService();
const result = await chessService.createGame('player1-id', 'player2-id');

// Make a move and save it
const moveResult = await chessService.makeMove('e2', 'e4');
if (moveResult.success) {
  await chessService.saveGame();
  await chessService.saveMove(moveResult.san!, 1);
}

// Subscribe to real-time updates
const unsubscribe = chessService.subscribeToGame(gameId, (payload) => {
  console.log('Game updated:', payload);
});
```

## Security

Row Level Security (RLS) is enabled with policies that ensure:
- Users can only access games they are part of
- Anonymous users can create and play games
- Move history is only accessible to game participants

## Deployment

When deploying to production, make sure to:
1. Set your environment variables in your hosting platform
2. Ensure your Supabase project is in production mode
3. Consider upgrading your Supabase plan if needed for higher usage

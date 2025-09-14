# ♔ For My Qu## 🌐 Online Multiplayer (Beta)

- **Play Online**: Real-time matches over WebSockets with a lightweight Node server
- **Room Links**: Create or join a room via sharable URL (auto-generated)
- **Turn Enforcement**: Your board is disabled wheNew Game flow:

- Click "Start New Royal Match" to open a modal with options:
  - **"2 vs 2 on this machine"**: Local play with optional auto-rotate
  - **"Play online with someone"**: Opens `/online` for room-based multiplayer
  - **"Invite by username"**: Send timed invite to a specific user

### New Features

#### Game Mode Selection Modal

- All "New Game" buttons now open a choice modal instead of directly creating games
- Three distinct game modes for different play styles

#### Username-Based Invites

- Send match requests to friends by entering their username
- 5-minute expiration timer with live countdown
- Real-time acceptance/decline via notification bell
- Automatic routing to shared room on acceptance

#### Board Enhancements

- **Auto-Rotate Toggle**: In local 2v2, option to flip board for each player's turn
- **Board Orientation**: Online games show your color at bottom, opponent at top
- **Coordinate Labels**: Professional a-h/1-8 labels on board edges
- **Improved Readability**: Enhanced label contrast and sizing

#### Real-time Features

- Instant invite notifications via Supabase Realtime (when enabled)
- Fallback to polling for compatibility
- Live status updates during gameplayisn't your turn
- **Resilient UX**: Clear status when an opponent disconnects
- **Username Invites**: Send match requests to friends by username with 5-minute expiry
- **Board Orientation**: Your color always appears at the bottom
- **Coordinate Labels**: Professional a-h/1-8 labels like chess.com

### Invite System

- **Send Invites**: Use "New Game" → "Invite by username" to send match requests
- **Receive Invites**: Bell icon shows pending invites; accept/decline inline
- **Auto-Route**: Accepted invites automatically route both players to shared room
- **Real-time Updates**: Instant notifications via Supabase Realtime (optional)

### Local 2v2 Enhancements

- **Auto-Rotate**: Toggle to automatically flip board for each player's turn
- **Manual Control**: Option to keep traditional white-bottom orientationFull-Stack Chess Game

A comprehensive chess web application built with Next.js, TypeScript, MySQL, and chess.js, featuring advanced game tracking, persistence, and a beautiful UI that matches professional chess interfaces.

## 🎯 Features

### 🧩 Interactive Chess Board

- **Exact UI Replication**: Matches the provided screenshot design using Tailwind CSS
- **Full Chess Logic**: Powered by chess.js for accurate move validation and game rules
- **Visual Feedback**: Highlighted squares, possible moves, and piece selection
- **Game State Management**: Real-time turn tracking and check detection

### 🌐 Online Multiplayer (Beta)

- **Play Online**: Real-time matches over WebSockets with a lightweight Node server
- **Room Links**: Create or join a room via sharable URL (auto-generated)
- **Turn Enforcement**: Your board is disabled when it isn’t your turn
- **Resilient UX**: Clear status when an opponent disconnects

### 💾 Advanced Database Integration (MySQL)

- **Normalized Schema**: Proper table structure for games, moves, and statistics
- **Stored Procedures**: Automated game creation, move recording, and completion
- **Triggers**: Auto-updating timestamps and game status changes
- **Views**: Recent games, ongoing games, and comprehensive statistics
- **Functions**: Player statistics and game analysis

### 🎮 Game Management

- **Persistent Games**: Every move saved to MySQL with full history
- **Resume Capability**: Load and continue any previous game
- **Game Library**: View all games with status, dates, and quick actions
- **FEN/PGN Support**: Export and copy game positions and notation

### 📱 Responsive Design

- **Dark Theme**: Professional chess interface with amber/brown board colors
- **Mobile Friendly**: Fully responsive layout for all screen sizes
- **Status Panel**: Live game information, captured pieces, and move history
- **Intuitive Controls**: Easy game creation, deletion, and navigation

## 🛠️ Tech Stack

- **Framework**: Next.js 15 with App Router and TypeScript
- **UI**: Tailwind CSS for styling and responsive design
- **Chess Engine**: chess.js for game logic and move validation
- **Database**: MySQL with raw SQL (no ORM) for maximum performance
- **State Management**: React Server Components and Server Actions
- **API**: RESTful endpoints for game operations

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- MySQL 8.0+ server running locally or remotely
- Git for cloning the repository

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd nyre
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   Copy `.env.local` and update database credentials:

   ```env
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=chess_game
   DB_PORT=3306
   ```

4. **Initialize the database**

   ```bash
   npm run setup-db
   ```

   This script will:

   - Test your database connection
   - Create the `chess_game` database
   - Set up all tables, procedures, triggers, views, and functions
   - Initialize game statistics

5. **Start the development server**

   ```bash
   npm run dev
   ```

6. **Open your browser**

   Navigate to [http://localhost:3000](http://localhost:3000)

7. **Enable Online Multiplayer**

   Open a second terminal and start the WebSocket server:

   ```bash
   npm run ws:start
   ```

   Configuration:

   - By default the client connects to `ws://localhost:8080`.
   - Set `NEXT_PUBLIC_WS_PORT=8080` or `NEXT_PUBLIC_WS_URL=ws://your-host:port` in `.env.local`

8. **(RECOMMENDED) Enable Supabase Realtime for Instant Invites**

   In your Supabase Dashboard:

   - Go to Database → Replication
   - Find the `public.invites` table
   - Toggle "Enable Realtime"
   - This enables instant invite notifications without polling

   After changing env, restart the Next.js dev server.

## 📊 Database Schema

### Tables

- **`games`**: Core game data (FEN, PGN, status, players, timestamps)
- **`moves`**: Individual move records with notation and positions
- **`game_stats`**: Global statistics and analytics

### Stored Procedures

- **`CreateNewGame()`**: Initialize a new chess game
- **`RecordMove()`**: Save move and update game state
- **`CompleteGame()`**: Mark game as finished and update stats

### Views

- **`recent_games`**: Last 20 games with move counts
- **`ongoing_games`**: Currently active games
- **`game_statistics`**: Win/loss ratios and averages

### Triggers

- **`update_game_on_move`**: Auto-update game timestamps

### Functions

- **`GetPlayerStats()`**: Player-specific statistics in JSON format

## 🎮 How to Play

### Starting a New Game

1. Click "🎯 Start New Game" on the home page
2. You'll be redirected to the board with a fresh game
3. White always moves first

### Making Moves

1. Click on a piece to select it (highlights possible moves)
2. Click on a highlighted square to make the move
3. The game automatically validates all moves using chess.js
4. Each move is instantly saved to the database

### Game Features

- **Turn Indicator**: Shows whose turn it is
- **Check Detection**: Visual warning when king is in check
- **Game Status**: Automatic detection of checkmate, stalemate, and draws
- **Move History**: Complete notation history in the side panel
- **Captured Pieces**: Visual display of taken pieces

### Game Management

- **Resume Games**: Click "▶️ Resume" on any active game
- **View Completed Games**: Click "👁️ View" to see finished games
- **Delete Games**: Use the 🗑️ button to remove unwanted games
- **Export**: Copy FEN positions or PGN notation for analysis

## 🔗 API Endpoints

### Games

- `GET /api/games` - List all games
- `POST /api/games` - Create new game
- `DELETE /api/games?id={id}` - Delete game

### Game Operations

- `GET /api/games/{id}` - Get specific game
- `POST /api/games/{id}` - Make a move
- `GET /api/games/{id}/moves` - Get possible moves

## 🌐 Routing

| Route                | Description                                     |
| -------------------- | ----------------------------------------------- |
| `/`                  | Home page with game library and new game option |
| `/board`             | Start a new chess game                          |
| `/board?id={gameId}` | Resume or view a specific game                  |

## 🕹️ Online Multiplayer (Beta)

Online play is powered by a small Node WebSocket server and a browser client:

- Start both servers locally:
  - Next.js app: `npm run dev`
  - WS server: `npm run ws:start` (or `npm run ws:dev` for TS)
- Open the Online screen:
  - From Home, click “Play Online (Beta)” or go to `/online`.
  - A room ID is generated automatically if one isn’t present in the URL.
  - Share the link with your opponent (the page shows a copyable URL).
- Colors and turns:
  - The first player becomes white, the next becomes black.
  - The board is disabled for you when it’s your opponent’s turn.
- Sync and status:
  - Moves are validated server-side and broadcast to both players.
  - Disconnections show “Opponent left the game.”

Environment variables:

- `NEXT_PUBLIC_WS_PORT` (default 8080) or `NEXT_PUBLIC_WS_URL` for a full endpoint.
- If deploying the WS server separately, set `NEXT_PUBLIC_WS_URL` to the public ws(s) URL and redeploy the app.

New Game flow:

- The left “Main Menu” navigator’s “New Game” opens a modal to choose:
  - “2 vs 2 on this machine” (local play)
  - “Play online with someone” (opens `/online`)

## 🔧 Development

### Database Management

```bash
# Reset and reinitialize database
npm run setup-db

# View database logs during development
tail -f /var/log/mysql/error.log
```

### Code Structure

```
src/
├── app/                 # Next.js app router pages
│   ├── api/            # API route handlers
│   ├── board/          # Chess board page
│   └── page.tsx        # Home page
├── components/         # React components
│   ├── ChessBoard.tsx  # Main chess board component
│   └── GameStatusPanel.tsx # Game info sidebar
├── lib/               # Utility libraries
│   ├── database.ts    # MySQL connection and schema
│   └── chess-service.ts # Chess game logic wrapper
└── types/             # TypeScript type definitions
    └── chess.ts       # Game and move interfaces
```

### Key Components

**ChessBoard Component**

- Renders 8x8 grid with piece positioning
- Handles click events and move validation
- Provides visual feedback for selections and possible moves
- Integrates with chess.js for game logic

**GameStatusPanel Component**

- Shows current game state and turn information
- Displays captured pieces with chess symbols
- Provides scrollable move history
- Indicates game status (active, checkmate, etc.)

## 🎨 Design Philosophy

The application replicates the exact look and feel of professional chess interfaces:

- **Color Scheme**: Dark theme with amber/brown board squares
- **Typography**: Clean, readable fonts with proper hierarchy
- **Visual Hierarchy**: Clear separation between board, controls, and information
- **Responsive Design**: Adapts seamlessly to different screen sizes
- **Accessibility**: High contrast and keyboard navigation support

## 🚀 Production Deployment

### Database Setup

1. Create a production MySQL database
2. Update environment variables for production
3. Run the database initialization script
4. Ensure proper database user permissions

### Next.js Deployment

```bash
npm run build
npm start
```

### Environment Variables

Set these in your production environment:

- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`
- `NEXT_PUBLIC_API_URL` (your production domain)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License. See LICENSE file for details.

## 🙏 Acknowledgments

- **chess.js** - Excellent chess game logic library
- **Next.js** - React framework with excellent developer experience
- **Tailwind CSS** - Utility-first CSS framework
- **MySQL** - Reliable database for game persistence

---

Built with ❤️ for chess enthusiasts and developers who appreciate clean, well-structured code.

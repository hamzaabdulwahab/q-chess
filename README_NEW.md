# ♔ For My Queen - Full-Stack Chess Game

A comprehensive chess web application built with Next.js, TypeScript, MySQL, and chess.js, featuring advanced game tracking, persistence, and a beautiful UI that matches professional chess interfaces.

## 🎯 Features

### 🧩 Interactive Chess Board

- **Exact UI Replication**: Matches the provided screenshot design using Tailwind CSS
- **Full Chess Logic**: Powered by chess.js for accurate move validation and game rules
- **Visual Feedback**: Highlighted squares, possible moves, and piece selection
- **Game State Management**: Real-time turn tracking and check detection

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

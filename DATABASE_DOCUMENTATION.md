# Chess Game Database Implementation

## Overview

This document explains how the MySQL database is integrated and used in the chess game application.

## Database Schema Files

### 1. `database_schema.sql`

Complete MySQL schema with all tables, views, stored procedures, functions, and triggers used in the application.

### 2. `scripts/setup-db.js`

Node.js script that programmatically creates the database schema and initializes the application.

### 3. `src/lib/database.ts`

TypeScript module that manages database connections using MySQL2 connection pooling.

## Database Usage in Application

### Connection Management

```typescript
// File: src/lib/database.ts
import mysql from "mysql2/promise";

export const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "chess_game",
  port: parseInt(process.env.DB_PORT || "3306"),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});
```

### Database Operations Used

#### 1. Creating New Games

- **Stored Procedure**: `CreateNewGame()`
- **Used in**: `/api/games` POST endpoint
- **Purpose**: Creates a new chess game with default starting position

#### 2. Recording Moves

- **Stored Procedure**: `RecordMove()`
- **Used in**: `/api/games/[id]/moves` POST endpoint
- **Purpose**: Records each chess move and updates game state

#### 3. Retrieving Games

- **View**: `recent_games`
- **Used in**: Home page game list
- **Purpose**: Shows all games with move counts for the archive

#### 4. Game State Management

- **Table**: `games`
- **Used in**: Board page for loading game state
- **Purpose**: Stores FEN notation, current player, game status

#### 5. Move History

- **Table**: `moves`
- **Used in**: Board page for displaying move history
- **Purpose**: Complete record of all moves in each game

## Key Database Features Demonstrated

### 1. **Relational Design**

- Foreign key relationship between `games` and `moves` tables
- Cascading deletes to maintain data integrity

### 2. **Data Validation**

- ENUM types for game status, players, and winners
- NOT NULL constraints on critical fields

### 3. **Performance Optimization**

- Indexes on frequently queried columns
- Views for complex aggregated data
- Connection pooling for concurrent access

### 4. **Advanced MySQL Features**

- **Stored Procedures**: For complex business logic
- **Triggers**: Automatic timestamp updates
- **Functions**: JSON-formatted statistics
- **Views**: Optimized data retrieval

### 5. **Data Integrity**

- Foreign key constraints
- CASCADE deletes
- Transaction-safe operations

## Application Integration Points

### API Endpoints Using Database:

1. **GET /api/games**

   - Queries `recent_games` view
   - Returns list of all games with statistics

2. **POST /api/games**

   - Calls `CreateNewGame()` stored procedure
   - Returns new game ID

3. **GET /api/games/[id]**

   - Queries `games` and `moves` tables
   - Returns complete game state and move history

4. **POST /api/games/[id]/moves**

   - Calls `RecordMove()` stored procedure
   - Updates game state and records move

5. **DELETE /api/games**
   - Direct table operations
   - Removes games and associated moves

### Real-time Features:

- Move counting using actual database records
- Game state persistence across sessions
- Complete move history tracking
- Statistics calculation

## Environment Configuration

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=chess_game
DB_PORT=3306
```

## Database Setup Commands

```bash
# Setup database schema
npm run setup-db

# Start application (connects to database)
npm run dev
```

## Educational Value

This implementation demonstrates:

- **Database Design**: Proper normalization and relationships
- **SQL Skills**: Complex queries, procedures, functions
- **Integration**: Database with modern web application
- **Best Practices**: Connection pooling, error handling
- **Real-world Usage**: Complete application with persistent data

The database serves as the backbone of the chess application, storing game state, tracking moves, and providing statistics - showcasing practical database implementation in a modern web application.

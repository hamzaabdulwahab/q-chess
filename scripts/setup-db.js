#!/usr/bin/env node

const mysql = require("mysql2/promise");
require("dotenv").config({ path: ".env.local" });

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "chess_game",
  port: parseInt(process.env.DB_PORT || "3306"),
};

async function testConnection() {
  try {
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      port: dbConfig.port,
    });
    await connection.execute("SELECT 1");
    await connection.end();
    return true;
  } catch (error) {
    console.error("Database connection failed:", error);
    return false;
  }
}

async function initializeDatabase() {
  // First create the database if it doesn't exist
  let connection = await mysql.createConnection({
    host: dbConfig.host,
    user: dbConfig.user,
    password: dbConfig.password,
    port: dbConfig.port,
  });

  try {
    // Create database if it doesn't exist
    await connection.execute(
      `CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`
    );
    await connection.end();

    // Now connect to the specific database
    connection = await mysql.createConnection(dbConfig);

    // Create tables
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS games (
        id INT AUTO_INCREMENT PRIMARY KEY,
        fen VARCHAR(100) NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        pgn TEXT,
        status ENUM('active', 'checkmate', 'stalemate', 'draw', 'abandoned') DEFAULT 'active',
        current_player ENUM('white', 'black') DEFAULT 'white',
        winner ENUM('white', 'black', 'draw') NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        move_count INT DEFAULT 0,
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS moves (
        id INT AUTO_INCREMENT PRIMARY KEY,
        game_id INT NOT NULL,
        move_number INT NOT NULL,
        player ENUM('white', 'black') NOT NULL,
        move_notation VARCHAR(10) NOT NULL,
        fen_before VARCHAR(100) NOT NULL,
        fen_after VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
        INDEX idx_game_id (game_id),
        INDEX idx_move_number (move_number)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS game_stats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        total_games INT DEFAULT 0,
        white_wins INT DEFAULT 0,
        black_wins INT DEFAULT 0,
        draws INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Initialize stats if empty
    await connection.execute(`
      INSERT IGNORE INTO game_stats (id, total_games) VALUES (1, 0)
    `);

    // Create views
    await connection.execute(`
  CREATE OR REPLACE VIEW recent_games AS
  SELECT * FROM (
    SELECT 
      g.id,
      g.status,
      g.current_player,
      g.winner,
      g.created_at,
      g.updated_at,
      COUNT(m.id) AS total_moves
    FROM games g
    LEFT JOIN moves m ON g.id = m.game_id
    GROUP BY g.id
    ORDER BY g.updated_at DESC
    LIMIT 20
  ) AS recent_sub
`);

    await connection.execute(`
  CREATE OR REPLACE VIEW ongoing_games AS
  SELECT * FROM (
    SELECT 
      g.id,
      g.fen,
      g.current_player,
      g.created_at,
      g.updated_at,
      g.move_count
    FROM games g
    WHERE g.status = 'active'
    ORDER BY g.updated_at DESC
  ) AS ongoing_sub
`);

    await connection.execute(`
      CREATE OR REPLACE VIEW game_statistics AS
      SELECT 
        COUNT(*) as total_games,
        SUM(CASE WHEN winner = 'white' THEN 1 ELSE 0 END) as white_wins,
        SUM(CASE WHEN winner = 'black' THEN 1 ELSE 0 END) as black_wins,
        SUM(CASE WHEN winner = 'draw' THEN 1 ELSE 0 END) as draws,
        AVG(move_count) as avg_moves_per_game
      FROM games
      WHERE status IN ('checkmate', 'stalemate', 'draw')
    `);

    // Create stored procedures
    await connection.query(`DROP PROCEDURE IF EXISTS CreateNewGame`);
    await connection.query(`
      CREATE PROCEDURE CreateNewGame()
      BEGIN
        DECLARE new_game_id INT;
        
        INSERT INTO games (fen, status, current_player) 
        VALUES ('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'active', 'white');
        
        SET new_game_id = LAST_INSERT_ID();
        
        UPDATE game_stats SET total_games = total_games + 1 WHERE id = 1;
        
        SELECT new_game_id as game_id;
      END
    `);

    await connection.query(`DROP PROCEDURE IF EXISTS RecordMove`);
    await connection.query(`
      CREATE PROCEDURE RecordMove(
        IN p_game_id INT,
        IN p_move_number INT,
        IN p_player ENUM('white', 'black'),
        IN p_move_notation VARCHAR(10),
        IN p_fen_before VARCHAR(100),
        IN p_fen_after VARCHAR(100),
        IN p_pgn TEXT
      )
      BEGIN
        INSERT INTO moves (game_id, move_number, player, move_notation, fen_before, fen_after)
        VALUES (p_game_id, p_move_number, p_player, p_move_notation, p_fen_before, p_fen_after);
        
        UPDATE games 
        SET 
          fen = p_fen_after,
          pgn = p_pgn,
          current_player = CASE WHEN p_player = 'white' THEN 'black' ELSE 'white' END,
          move_count = (SELECT COUNT(*) FROM moves WHERE game_id = p_game_id),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = p_game_id;
      END
    `);

    await connection.query(`DROP PROCEDURE IF EXISTS CompleteGame`);
    await connection.query(`
      CREATE PROCEDURE CompleteGame(
        IN p_game_id INT,
        IN p_status ENUM('checkmate', 'stalemate', 'draw', 'abandoned'),
        IN p_winner ENUM('white', 'black', 'draw')
      )
      BEGIN
        UPDATE games 
        SET 
          status = p_status,
          winner = p_winner,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = p_game_id;
        
        UPDATE game_stats 
        SET 
          white_wins = CASE WHEN p_winner = 'white' THEN white_wins + 1 ELSE white_wins END,
          black_wins = CASE WHEN p_winner = 'black' THEN black_wins + 1 ELSE black_wins END,
          draws = CASE WHEN p_winner = 'draw' THEN draws + 1 ELSE draws END
        WHERE id = 1;
      END
    `);

    // Create triggers
    await connection.query(`DROP TRIGGER IF EXISTS update_game_on_move`);
    await connection.query(`
      CREATE TRIGGER update_game_on_move
      AFTER INSERT ON moves
      FOR EACH ROW
      BEGIN
        UPDATE games 
        SET updated_at = CURRENT_TIMESTAMP 
        WHERE id = NEW.game_id;
      END
    `);

    // Create functions
    await connection.query(`DROP FUNCTION IF EXISTS GetPlayerStats`);
    await connection.query(`
      CREATE FUNCTION GetPlayerStats(player_color ENUM('white', 'black'))
      RETURNS JSON
      READS SQL DATA
      DETERMINISTIC
      BEGIN
        DECLARE win_count INT DEFAULT 0;
        DECLARE total_count INT DEFAULT 0;
        DECLARE win_rate DECIMAL(5,2) DEFAULT 0.00;
        
        SELECT COUNT(*) INTO win_count
        FROM games 
        WHERE winner = player_color;
        
        SELECT COUNT(*) INTO total_count
        FROM games 
        WHERE status IN ('checkmate', 'stalemate', 'draw');
        
        IF total_count > 0 THEN
          SET win_rate = (win_count / total_count) * 100;
        END IF;
        
        RETURN JSON_OBJECT(
          'wins', win_count,
          'total_games', total_count,
          'win_rate', win_rate
        );
      END
    `);

    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Error initializing database:", error);
    throw error;
  } finally {
    await connection.end();
  }
}

async function setupDatabase() {
  console.log("🚀 Initializing chess game database...");

  try {
    // Test connection first
    console.log("📡 Testing database connection...");
    const connected = await testConnection();

    if (!connected) {
      console.error("❌ Database connection failed!");
      console.log(
        "Please ensure MySQL is running and check your .env.local file:"
      );
      console.log("- DB_HOST (default: localhost)");
      console.log("- DB_USER (default: root)");
      console.log("- DB_PASSWORD (default: empty)");
      console.log("- DB_NAME (default: chess_game)");
      console.log("- DB_PORT (default: 3306)");
      process.exit(1);
    }

    console.log("✅ Database connection successful!");

    // Initialize database schema
    console.log("🔧 Setting up database schema...");
    await initializeDatabase();

    console.log("✅ Database initialization complete!");
    console.log(
      "🎯 You can now start the development server with: npm run dev"
    );
  } catch (error) {
    console.error("❌ Database setup failed:", error.message);
    process.exit(1);
  }
}

setupDatabase();

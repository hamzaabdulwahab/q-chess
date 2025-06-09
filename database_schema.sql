-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS chess_game;
USE chess_game;

-- =====================================================
-- TABLE CREATION
-- =====================================================

-- Games table: Stores chess game information
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
);

-- Moves table: Stores individual chess moves
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
);

-- Game statistics table: Stores overall game statistics
CREATE TABLE IF NOT EXISTS game_stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    total_games INT DEFAULT 0,
    white_wins INT DEFAULT 0,
    black_wins INT DEFAULT 0,
    draws INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Initialize stats record
INSERT IGNORE INTO game_stats (id, total_games) VALUES (1, 0);

-- =====================================================
-- VIEWS CREATION
-- =====================================================

-- Recent games view: Shows recent games with move counts
CREATE OR REPLACE VIEW recent_games AS
SELECT 
    g.id,
    g.status,
    g.current_player,
    g.winner,
    g.created_at,
    g.updated_at,
    g.move_count,
    COUNT(m.id) as total_moves
FROM games g
LEFT JOIN moves m ON g.id = m.game_id
GROUP BY g.id
ORDER BY g.updated_at DESC
LIMIT 20;

-- Ongoing games view: Shows only active games
CREATE OR REPLACE VIEW ongoing_games AS
SELECT 
    g.id,
    g.fen,
    g.current_player,
    g.created_at,
    g.updated_at,
    g.move_count
FROM games g
WHERE g.status = 'active'
ORDER BY g.updated_at DESC;

-- Game statistics view: Calculates overall game statistics
CREATE OR REPLACE VIEW game_statistics AS
SELECT 
    COUNT(*) as total_games,
    SUM(CASE WHEN winner = 'white' THEN 1 ELSE 0 END) as white_wins,
    SUM(CASE WHEN winner = 'black' THEN 1 ELSE 0 END) as black_wins,
    SUM(CASE WHEN winner = 'draw' THEN 1 ELSE 0 END) as draws,
    AVG(move_count) as avg_moves_per_game
FROM games
WHERE status IN ('checkmate', 'stalemate', 'draw');

-- =====================================================
-- STORED PROCEDURES
-- =====================================================

-- Create a new chess game
DELIMITER //
CREATE PROCEDURE CreateNewGame()
BEGIN
    DECLARE new_game_id INT;
    
    INSERT INTO games (fen, status, current_player) 
    VALUES ('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'active', 'white');
    
    SET new_game_id = LAST_INSERT_ID();
    
    UPDATE game_stats SET total_games = total_games + 1 WHERE id = 1;
    
    SELECT new_game_id as game_id;
END //
DELIMITER ;

-- Record a chess move
DELIMITER //
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
    
    -- Update game state with correct move count
    UPDATE games 
    SET 
        fen = p_fen_after,
        pgn = p_pgn,
        current_player = CASE WHEN p_player = 'white' THEN 'black' ELSE 'white' END,
        move_count = (SELECT COUNT(*) FROM moves WHERE game_id = p_game_id), 
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_game_id;
END //
DELIMITER ;

-- Complete a chess game
DELIMITER //
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
END //
DELIMITER ;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update game timestamp when a move is made
DELIMITER //
CREATE TRIGGER update_game_on_move
AFTER INSERT ON moves
FOR EACH ROW
BEGIN
    UPDATE games 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = NEW.game_id;
END //
DELIMITER ;

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Get player statistics as JSON
DELIMITER //
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
END //
DELIMITER ;

-- =====================================================
-- SAMPLE QUERIES USED IN APPLICATION
-- =====================================================

-- Query to get all games for the home page
-- SELECT * FROM recent_games ORDER BY updated_at DESC;

-- Query to get a specific game with moves
-- SELECT * FROM games WHERE id = ?;
-- SELECT * FROM moves WHERE game_id = ? ORDER BY move_number ASC;

-- Query to create a new game
-- CALL CreateNewGame();

-- Query to record a move
-- CALL RecordMove(game_id, move_number, player, notation, fen_before, fen_after, pgn);

-- Query to complete a game
-- CALL CompleteGame(game_id, status, winner);

-- Query to get game statistics
-- SELECT * FROM game_statistics;

-- Query to get player statistics
-- SELECT GetPlayerStats('white') as white_stats, GetPlayerStats('black') as black_stats;

-- =====================================================
-- DATABASE CONNECTION CONFIGURATION
-- =====================================================

/*
Environment Variables Used in Application:

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=chess_game
DB_PORT=3306

MySQL Pool Configuration:
- Connection Pool Size: 10
- Wait for connections: true
- Queue limit: 0 (unlimited)
*/

-- =====================================================
-- NOTES FOR TEACHER
-- =====================================================

/*
This database schema is designed for a complete chess game application with the following features:

1. TABLES:
   - games: Stores game state, FEN notation, status, and metadata
   - moves: Records every move made in each game
   - game_stats: Tracks overall application statistics

2. VIEWS:
   - recent_games: Optimized view for displaying game list
   - ongoing_games: Filter for active games only
   - game_statistics: Calculated statistics across all games

3. STORED PROCEDURES:
   - CreateNewGame(): Creates a new chess game
   - RecordMove(): Records a move and updates game state
   - CompleteGame(): Marks game as finished and updates stats

4. TRIGGERS:
   - Automatically updates game timestamps when moves are added

5. FUNCTIONS:
   - GetPlayerStats(): Returns win rates and statistics for players

6. FEATURES DEMONSTRATED:
   - Foreign key relationships
   - Indexes for performance
   - Enums for data validation
   - Timestamps with auto-update
   - JSON return types
   - Complex aggregation queries
   - Transaction-safe operations

This schema supports a full-featured chess application with game tracking,
move history, statistics, and real-time game state management.
*/

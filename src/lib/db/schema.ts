import {
  mysqlTable,
  int,
  varchar,
  text,
  timestamp,
  mysqlEnum,
} from "drizzle-orm/mysql-core";

export const games = mysqlTable("games", {
  id: int("id").primaryKey().autoincrement(),
  fen: varchar("fen", { length: 255 })
    .notNull()
    .default("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"),
  pgn: text("pgn"),
  status: mysqlEnum("status", [
    "active",
    "checkmate",
    "stalemate",
    "draw",
    "resigned",
  ])
    .notNull()
    .default("active"),
  currentPlayer: mysqlEnum("current_player", ["white", "black"])
    .notNull()
    .default("white"),
  winner: mysqlEnum("winner", ["white", "black", "draw"]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  moveCount: int("move_count").notNull().default(0),
});

export const moves = mysqlTable("moves", {
  id: int("id").primaryKey().autoincrement(),
  gameId: int("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  moveNumber: int("move_number").notNull(),
  player: mysqlEnum("player", ["white", "black"]).notNull(),
  moveNotation: varchar("move_notation", { length: 20 }).notNull(),
  fenBefore: varchar("fen_before", { length: 255 }).notNull(),
  fenAfter: varchar("fen_after", { length: 255 }).notNull(),
  pgn: text("pgn"),
  capturedPiece: varchar("captured_piece", { length: 10 }),
  isCheck: int("is_check").notNull().default(0),
  isCheckmate: int("is_checkmate").notNull().default(0),
  isCastling: int("is_castling").notNull().default(0),
  isEnPassant: int("is_en_passant").notNull().default(0),
  isPromotion: int("is_promotion").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const gameStats = mysqlTable("game_stats", {
  id: int("id").primaryKey().autoincrement(),
  totalGames: int("total_games").notNull().default(0),
  activeGames: int("active_games").notNull().default(0),
  completedGames: int("completed_games").notNull().default(0),
  lastUpdated: timestamp("last_updated").notNull().defaultNow().onUpdateNow(),
});

// Types for the tables
export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;
export type Move = typeof moves.$inferSelect;
export type NewMove = typeof moves.$inferInsert;
export type GameStats = typeof gameStats.$inferSelect;
export type NewGameStats = typeof gameStats.$inferInsert;

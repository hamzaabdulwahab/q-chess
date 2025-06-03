import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { games, moves, gameStats } from "./schema";

// Create the connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "chess_game",
  port: parseInt(process.env.DB_PORT || "3306"),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Create the Drizzle database instance
export const db = drizzle(pool, {
  schema: { games, moves, gameStats },
  mode: "default",
});

// Test connection function
export async function testConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.execute("SELECT 1");
    connection.release();
    return true;
  } catch (error) {
    console.error("Database connection failed:", error);
    return false;
  }
}

#!/usr/bin/env bun
// Simple verification script to test if the app components can be imported

console.log("🧪 Testing app components...");

try {
  // Test if we can import the chess client
  const { ChessClient } = await import("./src/lib/chess-client.ts");
  console.log("✅ ChessClient imported successfully");

  // Test creating a chess instance
  const chess = new ChessClient();
  console.log("✅ ChessClient instance created");
  console.log("Initial FEN:", chess.getFen());

  // Test a move
  const moveResult = chess.makeMove("e2", "e4");
  console.log("✅ Move test:", moveResult.success ? "Success" : "Failed");
} catch (error) {
  console.error("❌ Error testing components:", error.message);
}

console.log("🎉 Component verification complete!");

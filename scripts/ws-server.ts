/*
  Simple WebSocket server for online multiplayer chess.
  - Manages rooms (gameId)
  - Syncs FEN/moves between two peers
  - Performs basic validation with chess.js
*/

import { WebSocketServer, WebSocket } from "ws";
import { Chess } from "chess.js";

const PORT = parseInt(process.env.WS_PORT || "8080", 10);

// Room state
type ClientInfo = {
  ws: WebSocket;
  color: "white" | "black";
};

type Room = {
  id: string;
  chess: Chess;
  clients: ClientInfo[]; // max 2
  finished?: { winner: "white" | "black"; reason?: string } | null;
};

const rooms = new Map<string, Room>();

function broadcast(room: Room, msg: unknown) {
  const data = JSON.stringify(msg);
  for (const c of room.clients) {
    if (c.ws.readyState === WebSocket.OPEN) c.ws.send(data);
  }
}

function assignColor(room: Room): "white" | "black" {
  if (!room.clients.find((c) => c.color === "white")) return "white";
  return "black";
}

function getOpponent(room: Room, ws: WebSocket): ClientInfo | undefined {
  return room.clients.find((c) => c.ws !== ws);
}

const wss = new WebSocketServer({ port: PORT });
console.log(`[ws] listening on ws://localhost:${PORT}`);

wss.on("connection", (ws) => {
  let currentRoom: Room | null = null;

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      // { type: 'join', gameId?, mode: 'online'|'local', fen? }
      // { type: 'move', from, to, promotion? }
      // { type: 'sync', fen }

      if (msg.type === "join") {
        const gameId = String(msg.gameId || "lobby");
        let room = rooms.get(gameId);
        if (!room) {
          room = { id: gameId, chess: new Chess(msg.fen), clients: [] };
          rooms.set(gameId, room);
        }
        if (room.clients.length >= 2) {
          ws.send(JSON.stringify({ type: "error", error: "room_full" }));
          ws.close();
          return;
        }
        const color = assignColor(room);
        room.clients.push({ ws, color });
        currentRoom = room;

        ws.send(
          JSON.stringify({
            type: "joined",
            gameId,
            color,
            fen: room.chess.fen(),
          })
        );
        const opp = getOpponent(room, ws);
        if (opp) {
          // notify both ready
          broadcast(room, { type: "ready", gameId, fen: room.chess.fen() });
        }
        return;
      }

      if (!currentRoom) return;

      if (msg.type === "move") {
        if (currentRoom.finished) {
          // ignore moves after game finished
          ws.send(
            JSON.stringify({
              type: "error",
              error: "game_finished",
            })
          );
          return;
        }
        const { from, to, promotion } = msg;
        const before = currentRoom.chess.fen();
        const move = currentRoom.chess.move({ from, to, promotion });
        if (!move) {
          ws.send(JSON.stringify({ type: "illegal", from, to }));
          return;
        }
        broadcast(currentRoom, {
          type: "moved",
          from,
          to,
          promotion,
          fen: currentRoom.chess.fen(),
          san: move.san,
        });
        return;
      }

      if (msg.type === "sync") {
        if (currentRoom.finished) {
          ws.send(JSON.stringify({ type: "error", error: "game_finished" }));
          return;
        }
        try {
          const tmp = new Chess(msg.fen);
          currentRoom.chess.load(tmp.fen());
          broadcast(currentRoom, {
            type: "synced",
            fen: currentRoom.chess.fen(),
          });
        } catch {
          ws.send(JSON.stringify({ type: "error", error: "bad_fen" }));
        }
        return;
      }

      if (msg.type === "timeout") {
        const { winner, reason } = msg as {
          winner: "white" | "black";
          reason?: string;
        };
        currentRoom.finished = { winner, reason };
        broadcast(currentRoom, { type: "timeout", winner, reason });
        return;
      }
    } catch (e) {
      ws.send(JSON.stringify({ type: "error", error: "bad_json" }));
    }
  });

  ws.on("close", () => {
    if (!currentRoom) return;
    currentRoom.clients = currentRoom.clients.filter((c) => c.ws !== ws);
    if (currentRoom.clients.length === 0) {
      rooms.delete(currentRoom.id);
    } else {
      broadcast(currentRoom, { type: "opponent_left" });
    }
  });
});

export {}; // keep TS happy

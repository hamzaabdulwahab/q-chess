/*
  Simple WebSocket server for online multiplayer chess (CommonJS).
  Run with: npm run ws:start
*/
const { WebSocketServer, WebSocket } = require("ws");
const { Chess } = require("chess.js");

const PORT = parseInt(process.env.WS_PORT || "8080", 10);

// Room state
/** @typedef {{ ws: import('ws'), color: 'white'|'black' }} ClientInfo */

/** @typedef {{ id: string, chess: import('chess.js').Chess, clients: ClientInfo[], finished?: { winner: 'white'|'black', reason?: string } | null }} Room */

/** @type {Map<string, Room>} */
const rooms = new Map();

function broadcast(room, msg) {
  const data = JSON.stringify(msg);
  for (const c of room.clients) {
    if (c.ws.readyState === WebSocket.OPEN) c.ws.send(data);
  }
}

function assignColor(room) {
  if (!room.clients.find((c) => c.color === "white")) return "white";
  return "black";
}

function getOpponent(room, ws) {
  return room.clients.find((c) => c.ws !== ws);
}

const wss = new WebSocketServer({ port: PORT });
console.log(`[ws] listening on ws://localhost:${PORT}`);

wss.on("connection", (ws) => {
  /** @type {Room|null} */
  let currentRoom = null;

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "join") {
        const gameId = String(msg.gameId || "lobby");
        let room = rooms.get(gameId);
        if (!room) {
          room = {
            id: gameId,
            chess: new Chess(msg.fen),
            clients: [],
            finished: null,
          };
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
          broadcast(room, { type: "ready", gameId, fen: room.chess.fen() });
        }
        return;
      }

      if (!currentRoom) return;

      if (msg.type === "move") {
        if (currentRoom.finished) {
          ws.send(JSON.stringify({ type: "error", error: "game_finished" }));
          return;
        }
        const { from, to, promotion } = msg;
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
        const winner = msg.winner === "white" ? "white" : "black";
        const reason = typeof msg.reason === "string" ? msg.reason : undefined;
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

module.exports = {};

/*
  Quick WS timeout flow test: connects two clients to the local ws server,
  plays two opening moves, triggers a timeout, then verifies no further moves allowed.
  Run with: node scripts/ws-timeout-test.js
*/
const { WebSocket } = require("ws");

const URL =
  process.env.WS_URL || `ws://localhost:${process.env.WS_PORT || 8080}`;
const ROOM = `timeout-${Math.random().toString(36).slice(2, 8)}`;

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  const logs = [];
  const a = new WebSocket(URL);
  const b = new WebSocket(URL);
  let aColor = null;
  let readyCount = 0;
  let movedCount = 0;
  let timeoutBroadcast = 0;
  let postFinishError = 0;

  function log(msg) {
    logs.push(msg);
    console.log(msg);
  }

  function wire(name, ws) {
    ws.on("message", (buf) => {
      const msg = JSON.parse(buf.toString());
      if (msg.type === "joined") {
        log(`${name}: joined as ${msg.color}`);
        if (name === "A") aColor = msg.color;
      } else if (msg.type === "ready") {
        readyCount++;
        log(`${name}: ready`);
      } else if (msg.type === "moved") {
        movedCount++;
        log(
          `${name}: moved broadcast ${msg.san} turnFen=${msg.fen
            .split(" ")
            .slice(0, 2)
            .join(" ")}`
        );
      } else if (msg.type === "timeout") {
        timeoutBroadcast++;
        log(`${name}: timeout winner=${msg.winner}`);
      } else if (msg.type === "error") {
        if (msg.error === "game_finished") postFinishError++;
        log(`${name}: error ${msg.error}`);
      } else if (msg.type === "illegal") {
        log(`${name}: illegal ${msg.from}-${msg.to}`);
      }
    });
  }

  wire("A", a);
  wire("B", b);

  await new Promise((resolve) => a.once("open", resolve));
  a.send(JSON.stringify({ type: "join", gameId: ROOM }));
  await new Promise((resolve) => b.once("open", resolve));
  b.send(JSON.stringify({ type: "join", gameId: ROOM }));

  // Give server time to pair and send ready
  await delay(200);

  // White moves e2e4
  if (aColor === "white") {
    a.send(JSON.stringify({ type: "move", from: "e2", to: "e4" }));
  } else {
    b.send(JSON.stringify({ type: "move", from: "e2", to: "e4" }));
  }

  await delay(200);
  // Black plays e7e5
  if (aColor === "white") {
    b.send(JSON.stringify({ type: "move", from: "e7", to: "e5" }));
  } else {
    a.send(JSON.stringify({ type: "move", from: "e7", to: "e5" }));
  }

  await delay(200);
  // Simulate black timeout -> white wins
  const winner = "white";
  // Let A send the timeout regardless; server just broadcasts
  a.send(JSON.stringify({ type: "timeout", winner, reason: "test_timeout" }));

  await delay(200);
  // Try a move after finish, should yield error game_finished
  a.send(JSON.stringify({ type: "move", from: "g1", to: "f3" }));

  await delay(200);

  // Evaluate
  if (readyCount < 1) {
    console.error("FAIL: ready not received");
    process.exit(1);
  }
  if (movedCount < 2) {
    console.error("FAIL: expected at least 2 moved broadcasts");
    process.exit(1);
  }
  if (timeoutBroadcast < 2) {
    console.error("FAIL: both clients should receive timeout broadcast");
    process.exit(1);
  }
  if (postFinishError < 1) {
    console.error("FAIL: move after finish should emit game_finished error");
    process.exit(1);
  }

  log("PASS: timeout flow works");
  process.exit(0);
}

run().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});

/**
 * Stockfish engine wrapper. Server-only — never import from a client
 * component.
 *
 * Resolution order for the binary:
 *   1. process.env.STOCKFISH_PATH — a native Stockfish binary on disk
 *      (fastest; recommended for production VPS / Docker).
 *   2. The bundled WASM build shipped by the `stockfish` npm package
 *      (Stockfish 18). Works out of the box and on Vercel; slightly
 *      slower than native, so searches use short practical movetimes
 *      with maximum skill instead of blocking the UI for seconds.
 *
 * Process lifecycle:
 *   - Lazy module-level singleton. First call starts the engine, sends
 *     `uci` + `isready` + the static UCI options.
 *   - All subsequent calls share that one engine instance.
 *   - A FIFO async queue serialises `search()` calls so the engine never
 *     receives two `go` commands in flight.
 *   - On engine death (process exit / parse error) the singleton is
 *     cleared so the next call respawns.
 */

import {
  spawn,
  type ChildProcessByStdio,
} from "node:child_process";
import path from "node:path";
import type { Readable, Writable } from "node:stream";
import type { StockfishSearchContext } from "./search-context";
import type { BotLevel } from "./types";

interface EngineProcess {
  child: ChildProcessByStdio<Writable, Readable, Readable>;
  alive: boolean;
  listeners: Set<(line: string) => void>;
}

// HMR-safe singleton. In Next.js dev mode every code edit to this file
// reloads the module, which would otherwise spawn a fresh Stockfish
// process while orphaning the old one (each ~50MB). Stashing the
// promise on globalThis lets a new module reuse the existing engine
// across hot reloads.
interface EngineGlobals {
  enginePromise: Promise<EngineProcess> | null;
  queue: Promise<unknown>;
}
const globalKey = "__qchess_stockfish__";
const globalAny = globalThis as unknown as Record<string, EngineGlobals>;
if (!globalAny[globalKey]) {
  globalAny[globalKey] = {
    enginePromise: null,
    queue: Promise.resolve(),
  };
}
const engineGlobals: EngineGlobals = globalAny[globalKey];
const STOCKFISH_HARD_CAP_MS = 1500;
const STOCKFISH_MOVETIME_CAP_MS = 1300;

function getLineListeners(state: EngineProcess): Set<(line: string) => void> {
  return state.listeners;
}

function resolveBinary(): {
  cmd: string;
  args: string[];
} {
  const explicit = process.env.STOCKFISH_PATH;
  if (explicit && explicit.length > 0) {
    return { cmd: explicit, args: [] };
  }
  // Fallback: spawn the bundled WASM build via the current Node binary.
  // The `stockfish` npm package ships Stockfish 18 builds under
  // `bin/`, not `src/`. We use the multithreaded build (max 32 threads),
  // which Node can launch directly with `node bin/stockfish-18.js`.
  const wasmEntry = path.join(
    process.cwd(),
    "node_modules",
    "stockfish",
    "bin",
    "stockfish-18.js",
  );
  return { cmd: process.execPath, args: [wasmEntry] };
}

async function startEngine(): Promise<EngineProcess> {
  const { cmd, args } = resolveBinary();
  const child = spawn(cmd, args, {
    stdio: ["pipe", "pipe", "pipe"],
  }) as ChildProcessByStdio<Writable, Readable, Readable>;

  const state: EngineProcess = {
    child,
    alive: true,
    listeners: new Set(),
  };

  // Line-buffered stdout fanout to whoever is currently awaiting a
  // specific UCI response.
  let buffer = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      for (const listener of state.listeners) listener(line);
    }
  });

  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    // Stockfish rarely writes to stderr — when it does it's almost
    // always something we want to see (e.g. wasm load failure on a
    // misconfigured deploy). Surface unconditionally; Vercel runtime
    // logs are cheap.
    console.error("[stockfish stderr]", chunk.toString().trim());
  });

  child.on("exit", () => {
    state.alive = false;
    if (engineGlobals.enginePromise) engineGlobals.enginePromise = null;
  });

  // Helper: send a command and wait for a marker line.
  const send = (cmd: string, marker: string, timeoutMs: number) =>
    new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        state.listeners.delete(handler);
        reject(new Error(`Timed out waiting for "${marker}"`));
      }, timeoutMs);
      const handler = (line: string) => {
        if (line === marker || line.startsWith(marker + " ")) {
          clearTimeout(timer);
          state.listeners.delete(handler);
          resolve();
        }
      };
      state.listeners.add(handler);
      child.stdin.write(cmd + "\n");
    });

  // Boot the engine. UCI handshake, ready check, then static options.
  await send("uci", "uciok", 20_000);
  await send("isready", "readyok", 10_000);

  const threads = Math.max(
    1,
    Math.min(8, Number(process.env.STOCKFISH_THREADS) || 2),
  );
  const hashMb = Math.max(
    16,
    Math.min(2048, Number(process.env.STOCKFISH_HASH_MB) || 128),
  );

  const setOption = (name: string, value: string | number) => {
    child.stdin.write(`setoption name ${name} value ${value}\n`);
  };
  setOption("Threads", threads);
  setOption("Hash", hashMb);
  setOption("MultiPV", 1);
  setOption("Move Overhead", 50);
  await send("isready", "readyok", 10_000);

  return state;
}

function getEngine(): Promise<EngineProcess> {
  if (!engineGlobals.enginePromise) {
    engineGlobals.enginePromise = startEngine().catch((err) => {
      engineGlobals.enginePromise = null;
      throw err;
    });
  }
  return engineGlobals.enginePromise;
}

function sendAndWaitForLine(
  engine: EngineProcess,
  command: string,
  marker: string,
  timeoutMs: number,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const listeners = getLineListeners(engine);
    const timer = setTimeout(() => {
      listeners.delete(handler);
      reject(new Error(`Timed out waiting for "${marker}"`));
    }, timeoutMs);
    const handler = (line: string) => {
      if (line === marker || line.startsWith(marker + " ")) {
        clearTimeout(timer);
        listeners.delete(handler);
        resolve();
      }
    };
    listeners.add(handler);
    engine.child.stdin.write(command + "\n");
  });
}

export async function warmStockfishEngine(): Promise<void> {
  await getEngine();
}

interface LevelConfig {
  /** UCI options to apply before each search. */
  options: Array<{ name: string; value: string | number }>;
  /** Wall-clock movetime in milliseconds. */
  movetimeMs: number;
}

function levelConfig(level: BotLevel): LevelConfig {
  // Movetimes are tuned to feel near-instant while keeping every tier
  // well above human strength. Stockfish 18 on the WASM build searches
  // depth 12-14 in ~250 ms and depth 16-18 in ~450 ms — at depth 14+
  // the engine is already ~2500 Elo, which is grandmaster territory.
  // Spending another second per move adds nothing a human can punish.
  // Override via env if a deployment needs to dial these up or down.
  const masterMs = Number(process.env.STOCKFISH_MASTER_MOVETIME_MS) || 300;
  const monsterMs = Number(process.env.STOCKFISH_MONSTER_MOVETIME_MS) || 350;

  switch (level) {
    case "beginner":
      return {
        options: [
          { name: "UCI_LimitStrength", value: "true" },
          { name: "UCI_Elo", value: 900 },
          // Skill Level is honoured even when UCI_Elo isn't supported.
          { name: "Skill Level", value: 3 },
        ],
        movetimeMs: 200,
      };
    case "intermediate":
      return {
        options: [
          { name: "UCI_LimitStrength", value: "true" },
          { name: "UCI_Elo", value: 1500 },
          { name: "Skill Level", value: 8 },
        ],
        movetimeMs: 250,
      };
    case "advanced":
      return {
        options: [
          { name: "UCI_LimitStrength", value: "true" },
          { name: "UCI_Elo", value: 2000 },
          { name: "Skill Level", value: 15 },
        ],
        movetimeMs: 300,
      };
    case "master":
      return {
        options: [
          { name: "UCI_LimitStrength", value: "false" },
          { name: "Skill Level", value: 20 },
        ],
        movetimeMs: masterMs,
      };
    case "monster":
      return {
        options: [
          { name: "UCI_LimitStrength", value: "false" },
          { name: "Skill Level", value: 20 },
        ],
        movetimeMs: monsterMs,
      };
  }
}

function resolveAdaptiveDepth(context?: StockfishSearchContext): number {
  if (!context) return 10;

  const isEndgame = context.pieceCount <= 12;
  const isComplex = context.legalMoveCount > 20 || isEndgame;
  if (isComplex) return isEndgame ? 16 : 14;

  return context.fullMoveNumber <= 12 ? 8 : 10;
}

function resolveMovetimeMs(baseMs: number): number {
  return Math.max(100, Math.min(baseMs, STOCKFISH_MOVETIME_CAP_MS));
}

interface SearchResult {
  /** Best move in UCI long-algebraic, e.g. "e2e4", "e7e8q". */
  bestmove: string;
  /** ms the engine actually spent. */
  spentMs: number;
}

/**
 * Ask the engine for its best move at the given position.
 *
 * `positionSpec` is the body of a UCI `position` command:
 *   - `"startpos"` for the starting position
 *   - `"startpos moves e2e4 e7e5 ..."` for a move history
 *   - `"fen <fen>"` to set an arbitrary position by FEN
 *
 * Concurrency: every call goes through a module-level FIFO queue, so two
 * games served by the same Node process will be searched one after the
 * other, never in parallel on the same engine.
 */
export async function searchBestMove(
  positionSpec: string,
  level: BotLevel,
  context?: StockfishSearchContext,
): Promise<SearchResult> {
  const run = async (): Promise<SearchResult> => {
    const cfg = levelConfig(level);
    const depth = resolveAdaptiveDepth(context);
    const movetimeMs = resolveMovetimeMs(cfg.movetimeMs);
    const engine = await getEngine();
    if (!engine.alive) {
      engineGlobals.enginePromise = null;
      return run();
    }

    engine.child.stdin.write("stop\n");
    await sendAndWaitForLine(engine, "isready", "readyok", 10_000);

    // Per-search options first, since strength options must be set before
    // the search begins.
    for (const opt of cfg.options) {
      engine.child.stdin.write(
        `setoption name ${opt.name} value ${opt.value}\n`,
      );
    }
    await sendAndWaitForLine(engine, "isready", "readyok", 10_000);

    const positionCommand = `position ${positionSpec}`;

    // Build a search promise that resolves on the "bestmove" line. The
    // engine receives both an adaptive depth target and a short movetime;
    // the timeout is a hard backstop that sends `stop` before failing.
    const timeoutMs = STOCKFISH_HARD_CAP_MS;
    const start = Date.now();
    const listeners = getLineListeners(engine);
    const result = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        listeners.delete(handler);
        engine.child.stdin.write("stop\n");
        reject(new Error("Engine search timed out"));
      }, timeoutMs);
      const handler = (line: string) => {
        if (line === "readyok") return;
        if (line.startsWith("bestmove ")) {
          clearTimeout(timer);
          listeners.delete(handler);
          const parts = line.split(/\s+/);
          resolve(parts[1]);
        }
      };
      listeners.add(handler);
      engine.child.stdin.write("ucinewgame\n");
      engine.child.stdin.write(positionCommand + "\n");
      engine.child.stdin.write(`go depth ${depth} movetime ${movetimeMs}\n`);
    });

    if (!result || result === "(none)" || result === "0000") {
      throw new Error("Engine returned no legal move");
    }

    return { bestmove: result, spentMs: Date.now() - start };
  };

  if (engineGlobals.enginePromise) {
    void engineGlobals.enginePromise.then((engine) => {
      if (engine.alive) {
        engine.child.stdin.write("stop\n");
      }
    }).catch(() => undefined);
  }

  const current = engineGlobals.queue.then(run);
  // Never let a failed search poison the queue.
  engineGlobals.queue = current.catch(() => undefined);
  return current;
}

/** Used by health-check route. */
export async function getEngineStatus(): Promise<{
  alive: boolean;
  ready: boolean;
  binarySource: "native" | "wasm";
}> {
  const explicit = !!process.env.STOCKFISH_PATH;
  try {
    const engine = await getEngine();
    return {
      alive: engine.alive,
      ready: true,
      binarySource: explicit ? "native" : "wasm",
    };
  } catch {
    return { alive: false, ready: false, binarySource: explicit ? "native" : "wasm" };
  }
}

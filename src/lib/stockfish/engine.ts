/**
 * Stockfish engine wrapper. Server-only — never import from a client
 * component.
 *
 * Resolution order for the binary:
 *   1. process.env.STOCKFISH_PATH — a native Stockfish binary on disk
 *      (fastest; recommended for production VPS / Docker).
 *   2. The bundled WASM build shipped by the `stockfish` npm package
 *      (Stockfish 18). Works out of the box and on Vercel; slightly
 *      slower than native but at 3-second movetime still effectively
 *      unbeatable for any human.
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
    // Stockfish itself rarely writes to stderr; surface noisy output so
    // it's visible in Vercel logs without crashing the process.
    if (process.env.NODE_ENV === "development") {
      console.error("[stockfish stderr]", chunk.toString().trim());
    }
  });

  child.on("exit", (code) => {
    state.alive = false;
    if (process.env.NODE_ENV === "development") {
      console.warn(`[stockfish] engine exited with code ${code ?? "?"}`);
    }
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

interface LevelConfig {
  /** UCI options to apply before each search. */
  options: Array<{ name: string; value: string | number }>;
  /** Wall-clock movetime in milliseconds. */
  movetimeMs: number;
}

function levelConfig(level: BotLevel): LevelConfig {
  // Movetimes are configurable via env so an operator can dial things
  // down on a low-CPU deployment without changing code. Defaults are
  // tuned to feel snappy on the WASM build while still reaching very
  // strong play: Stockfish 18 at 1.2s on a single thread typically
  // searches depth 18 to 22, ~3000+ Elo, comfortably stronger than any
  // human player.
  const masterMs = Number(process.env.STOCKFISH_MASTER_MOVETIME_MS) || 900;
  const monsterMs = Number(process.env.STOCKFISH_MONSTER_MOVETIME_MS) || 1200;

  switch (level) {
    case "beginner":
      return {
        options: [
          { name: "UCI_LimitStrength", value: "true" },
          { name: "UCI_Elo", value: 900 },
          // Skill Level is honoured even when UCI_Elo isn't supported.
          { name: "Skill Level", value: 3 },
        ],
        movetimeMs: 600,
      };
    case "intermediate":
      return {
        options: [
          { name: "UCI_LimitStrength", value: "true" },
          { name: "UCI_Elo", value: 1500 },
          { name: "Skill Level", value: 8 },
        ],
        movetimeMs: 800,
      };
    case "advanced":
      return {
        options: [
          { name: "UCI_LimitStrength", value: "true" },
          { name: "UCI_Elo", value: 2000 },
          { name: "Skill Level", value: 15 },
        ],
        movetimeMs: 1000,
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
): Promise<SearchResult> {
  const run = async (): Promise<SearchResult> => {
    const cfg = levelConfig(level);
    const engine = await getEngine();
    if (!engine.alive) {
      engineGlobals.enginePromise = null;
      return run();
    }

    // Per-search options first, since strength options must be set before
    // the search begins.
    for (const opt of cfg.options) {
      engine.child.stdin.write(
        `setoption name ${opt.name} value ${opt.value}\n`,
      );
    }
    engine.child.stdin.write("isready\n");

    const positionCommand = `position ${positionSpec}`;

    // Build a search promise that resolves on the "bestmove" line. The
    // total time we allow is movetime plus a generous buffer for engine
    // latency and parsing.
    const envBuffer = Number(process.env.STOCKFISH_REQUEST_TIMEOUT_MS);
    const buffer =
      Number.isFinite(envBuffer) && envBuffer > 0 ? envBuffer : 4000;
    const timeoutMs = cfg.movetimeMs + buffer;
    const start = Date.now();
    const listeners = getLineListeners(engine);
    const result = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        listeners.delete(handler);
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
      engine.child.stdin.write(`go movetime ${cfg.movetimeMs}\n`);
    });

    if (!result || result === "(none)" || result === "0000") {
      throw new Error("Engine returned no legal move");
    }

    return { bestmove: result, spentMs: Date.now() - start };
  };

  const current = engineGlobals.queue.then(run);
  // Never let a failed search poison the queue.
  engineGlobals.queue = current.catch(() => undefined);
  return current;
}

// ──────────────────────────────────────────────────────────────────────
// Position analysis (used by /api/games/[id]/analyze).
// Captures the engine's evaluation (centipawns or moves-to-mate) and
// principal variation alongside the bestmove. All numbers are returned
// in WHITE's POV so downstream classification math doesn't need to
// know whose turn it was.
// ──────────────────────────────────────────────────────────────────────

export interface AnalysisResult {
  /** Engine's chosen move, UCI long-algebraic ("e2e4", "e7e8q"). */
  bestMoveUci: string;
  /** Centipawns from WHITE's POV; null when the line resolves to mate. */
  evalCp: number | null;
  /** Moves-to-mate from WHITE's POV (positive = White mates). */
  evalMate: number | null;
  /** Engine search depth (highest seen). */
  depth: number;
  /** Principal variation, UCI moves. */
  pvUci: string[];
  /** Wall-clock time the engine actually spent. */
  spentMs: number;
}

export interface AnalyzeOptions {
  /** Wall-clock movetime budget; defaults to 900 ms. */
  movetimeMs?: number;
  /** Hard depth cap (passed as `go depth N` instead of `go movetime`). */
  depth?: number;
}

/**
 * Run a one-shot analysis on the given position and return the best
 * move plus an evaluation snapshot at the deepest reached depth.
 *
 * `positionSpec` is the body of a UCI `position` command:
 *   - `"startpos"` for the starting position
 *   - `"startpos moves e2e4 e7e5 ..."` for a move history
 *   - `"fen <fen>"` to set an arbitrary position by FEN
 *
 * Concurrency mirrors `searchBestMove`: every call goes through the
 * shared FIFO queue so the engine never runs two searches at once.
 */
export async function analyzePosition(
  positionSpec: string,
  opts: AnalyzeOptions = {},
): Promise<AnalysisResult> {
  const movetimeMs = opts.movetimeMs ?? 900;
  const useDepth = typeof opts.depth === "number" && opts.depth > 0;

  // Determine side-to-move so we can flip Stockfish's POV-relative cp
  // value into the White-POV value our DB stores. UCI `position fen ...`
  // contains the side directly; `position startpos moves ...` requires
  // counting the moves.
  const whiteToMove = positionDescribesWhiteToMove(positionSpec);

  const run = async (): Promise<AnalysisResult> => {
    const engine = await getEngine();
    if (!engine.alive) {
      engineGlobals.enginePromise = null;
      return run();
    }

    // Single PV is enough for v1 classification.
    engine.child.stdin.write("setoption name MultiPV value 1\n");
    engine.child.stdin.write("isready\n");

    const totalBudget = useDepth
      ? 30_000
      : movetimeMs +
        (Number(process.env.STOCKFISH_REQUEST_TIMEOUT_MS) > 0
          ? Number(process.env.STOCKFISH_REQUEST_TIMEOUT_MS)
          : 4000);

    const start = Date.now();
    const listeners = getLineListeners(engine);

    // Accumulator: latest "best-so-far" snapshot from `info` lines. The
    // engine emits many of these as depth increases; we keep the one
    // with the highest depth. score cp / mate is in side-to-move POV
    // and gets flipped after the fact.
    let bestDepth = 0;
    let bestCp: number | null = null;
    let bestMate: number | null = null;
    let bestPv: string[] = [];

    const result = await new Promise<{ bestmove: string }>((resolve, reject) => {
      const timer = setTimeout(() => {
        listeners.delete(handler);
        reject(new Error("Engine analyze timed out"));
      }, totalBudget);

      const handler = (line: string) => {
        if (line === "readyok") return;
        if (line.startsWith("info ")) {
          // Don't bother with `info string` / `info currmove` chatter.
          if (line.includes(" string ")) return;
          const depthM = /\bdepth (\d+)/.exec(line);
          if (!depthM) return;
          const depth = parseInt(depthM[1], 10);
          const scoreM = /\bscore (cp|mate) (-?\d+)/.exec(line);
          if (!scoreM) return;
          // Only keep the deepest info line; later ones overwrite.
          if (depth < bestDepth) return;
          bestDepth = depth;
          if (scoreM[1] === "cp") {
            bestCp = parseInt(scoreM[2], 10);
            bestMate = null;
          } else {
            bestMate = parseInt(scoreM[2], 10);
            bestCp = null;
          }
          const pvM = /\bpv ((?:[a-h][1-8][a-h][1-8][qrbn]?(?: |$))+)/.exec(line);
          bestPv = pvM ? pvM[1].trim().split(/\s+/) : [];
          return;
        }
        if (line.startsWith("bestmove ")) {
          clearTimeout(timer);
          listeners.delete(handler);
          const parts = line.split(/\s+/);
          resolve({ bestmove: parts[1] });
        }
      };

      listeners.add(handler);
      engine.child.stdin.write("ucinewgame\n");
      engine.child.stdin.write(`position ${positionSpec}\n`);
      engine.child.stdin.write(
        useDepth
          ? `go depth ${opts.depth}\n`
          : `go movetime ${movetimeMs}\n`,
      );
    });

    if (!result.bestmove || result.bestmove === "(none)" || result.bestmove === "0000") {
      throw new Error("Engine returned no legal move");
    }

    // Flip the eval into White-POV.
    const sign = whiteToMove ? 1 : -1;
    return {
      bestMoveUci: result.bestmove,
      evalCp: bestCp == null ? null : bestCp * sign,
      evalMate: bestMate == null ? null : bestMate * sign,
      depth: bestDepth,
      pvUci: bestPv,
      spentMs: Date.now() - start,
    };
  };

  const current = engineGlobals.queue.then(run);
  engineGlobals.queue = current.catch(() => undefined);
  return current;
}

/**
 * Best-effort side-to-move detection from a UCI `position` argument.
 * Supports both `"fen <fen>"` (read field 2) and
 * `"startpos[ moves ...]"` (count plies, even = White to move).
 */
function positionDescribesWhiteToMove(spec: string): boolean {
  const trimmed = spec.trim();
  if (trimmed.startsWith("fen ")) {
    const fields = trimmed.slice(4).split(/\s+/);
    return fields[1] === "w";
  }
  // startpos [moves m1 m2 ...]
  const movesIdx = trimmed.indexOf("moves");
  if (movesIdx === -1) return true; // startpos with no moves = White to move
  const tail = trimmed.slice(movesIdx + 5).trim();
  if (!tail) return true;
  const plies = tail.split(/\s+/).length;
  return plies % 2 === 0;
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

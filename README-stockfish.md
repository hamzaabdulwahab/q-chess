# Play vs Stockfish

A serious chess opponent powered by the official Stockfish 18 engine.
Built as a separate game mode that runs entirely server-side so the
strongest level (`Monster`) is real Stockfish, not a weakened browser
imitation.

## What it does

- New "Play vs Stockfish" entry in the start-a-game modal.
- Color selector: White / Black / Random.
- Five strength tiers (Beginner → Monster). Monster is the default and
  uses full Stockfish strength with `Skill Level 20` and a 3 second
  per-move budget.
- Plays exactly like a normal game: legal-move validation, captures,
  promotion, castling, en passant, checkmate / stalemate / draw / 50-move
  rule, all the existing sound effects, move history with time-per-move,
  the end-game modal with "Play Again / Back to Lobby".
- Persists in the same `games` and `moves` tables as multiplayer games;
  the only difference is `mode = 'human_vs_stockfish'`, `bot_side`, and
  `bot_level`.

## Architecture

```
Browser
  └── /api/games/bot                Creates a bot game (one human seat).
       (returns gameId)
  └── /board?id=<gameId>
       └── On each turn change, if current_player === bot_side,
           fire POST /api/games/[id]/bot-move
              └── server validates: caller is participant, game is a bot
                  game, it's actually the engine's turn
              └── replays move history (UCI from moves table; falls back
                  to fen if any move lacks UCI)
              └── searchBestMove(positionSpec, level)  ← Stockfish 18
              └── validates engine reply against chess.js
              └── persists move + game update via service-role client
              └── returns new fen / status / san / uci to the client
```

Human-vs-human games are completely separate. The `bot-move` endpoint
checks `mode === 'human_vs_stockfish'` before doing anything; calling it
for a multiplayer game returns 400. The engine cannot be used as a live
analysis cheat tool.

### Strength settings

| Level | UCI_LimitStrength | UCI_Elo | Skill Level | movetime |
|--|--|--|--|--|
| Beginner | true | 900 | 3 | 600 ms |
| Intermediate | true | 1500 | 8 | 800 ms |
| Advanced | true | 2000 | 15 | 1000 ms |
| Master | false | — | 20 | 1500 ms |
| **Monster** (default) | false | — | 20 | **3000 ms** |

Monster mode at 3 s per move is effectively unbeatable for any human
even on a modest CPU. Crank `STOCKFISH_MONSTER_MOVETIME_MS` to 5000+ if
you want extra brutality.

## Local setup

The app ships with the `stockfish` npm package which contains the
official WASM build of Stockfish 18. No extra install is needed for
basic development.

For strongest play on a workstation, install native Stockfish and point
to it:

```bash
# macOS
brew install stockfish
echo "STOCKFISH_PATH=$(which stockfish)" >> .env.local

# Linux
sudo apt install stockfish
echo "STOCKFISH_PATH=$(which stockfish)" >> .env.local

# Then:
npm run dev
```

Native Stockfish is roughly 1.5x to 2x faster than WASM for the same
movetime, so it reaches deeper search and plays even harder.

## Production deployment

### Vercel (default)

Stockfish runs as the bundled WASM build inside the Node.js function.
Works out of the box. The function `runtime` is set to `nodejs` and
`maxDuration = 30` in `src/app/api/games/[id]/bot-move/route.ts`.

Caveat: serverless cold starts incur ~1 second to spawn the engine. The
first bot move after an idle period is slow. Fluid Compute reuses warm
instances so subsequent moves use the cached engine.

### VPS or Docker (recommended for high-traffic / max strength)

Run the existing Next.js app on a Node host with native Stockfish
installed and `STOCKFISH_PATH` set. No process model change required.

Sample Dockerfile snippet:

```Dockerfile
FROM node:24-bookworm-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends \
  stockfish ca-certificates && rm -rf /var/lib/apt/lists/*
ENV STOCKFISH_PATH=/usr/games/stockfish
WORKDIR /app
COPY --from=builder /app .
CMD ["node_modules/.bin/next", "start"]
```

## Environment variables

See `.env.example`. All Stockfish settings are optional; reasonable
defaults are in `src/lib/stockfish/engine.ts`.

| Variable | Default | Meaning |
|--|--|--|
| `STOCKFISH_PATH` | _(unset)_ | Native binary path; falls back to bundled WASM if missing. |
| `STOCKFISH_THREADS` | 2 | Search threads, clamped 1–8. |
| `STOCKFISH_HASH_MB` | 128 | TT size, clamped 16–2048 MB. |
| `STOCKFISH_MASTER_MOVETIME_MS` | 1500 | Movetime for Master level. |
| `STOCKFISH_MONSTER_MOVETIME_MS` | 3000 | Movetime for Monster level. |
| `STOCKFISH_REQUEST_TIMEOUT_MS` | 4000 | Slack on top of movetime before timing out. |
| `STOCKFISH_RATE_LIMIT_PER_MINUTE` | 60 | Per-user request cap. |

## Security model

- `POST /api/games/bot` requires an authenticated user. Blocks creation
  if the user has an active human-vs-human game.
- `POST /api/games/[id]/bot-move` requires authentication, RLS-scoped
  participation in the game, AND the game must be `mode =
  'human_vs_stockfish'`, AND `current_player === bot_side`, AND
  `status === 'active'`. Anything else returns 4xx without invoking
  the engine.
- Per-user rate limit on bot moves (in-memory).
- All engine output is re-validated against `chess.js` before being
  persisted; an illegal engine reply (parser bug, etc.) is rejected.
- The engine is never invoked for human-vs-human games, so it cannot
  be used as a live analysis tool.

## Manual test plan

1. **Play as white, beginner.** Pick White + Beginner, click Start.
   Make a legal move. After ~600 ms, Stockfish replies. The move
   appears on the board + in the side panel with timing.
2. **Play as black.** Pick Black + Monster. Click Start. Within ~3 s,
   Stockfish should have already made its opening move.
3. **Random color.** Pick Random; you should land on either side
   with even probability across multiple games.
4. **Illegal move from the client.** Open DevTools, hand-craft a
   `POST /api/games/[id]/moves` with an impossible move. The move
   route rejects it; the bot is never invoked.
5. **Reject bot-move for human-vs-human.** With an active multiplayer
   game's id, `POST /api/games/[id]/bot-move`. Response 400 "This is
   not a Stockfish game". No engine call.
6. **Reject bot-move when not bot's turn.** During a bot game, on
   your turn, force-fire `POST /api/games/[id]/bot-move`. Response
   409 "It is not the bot's turn".
7. **Promotion.** Push a pawn to the 8th rank; promotion dialog
   appears. Stockfish replies normally to the resulting position.
8. **Checkmate.** Set up a known mate (e.g. play scholar's mate
   against Beginner level); the end-game modal appears with "You
   won by checkmate".
9. **Engine crash recovery.** Kill the Stockfish process during a
   game (advanced: send SIGKILL via `pkill stockfish`). The next bot
   move respawns the engine and plays normally; you'll just see a
   slight delay on the first call after crash.
10. **Rate limit.** Loop `POST /api/games/[id]/bot-move` past the
    configured per-minute cap. Eventually returns 429 with
    `retryAfterMs`.
11. **Multiplayer still works.** Send and accept an invitation as
    normal. Both sides see moves in real time. Bot game changes do
    not touch the multiplayer code paths.

## Known limitations

- WASM build's threefold-repetition handling is only as good as the
  move history we send; we now persist `moves.uci` on every move, so
  the engine sees the full history once the table is populated for the
  game.
- No Syzygy tablebases. Adding them would require packaging or
  downloading the `.rtbw`/`.rtbz` files at deploy time and pointing
  `SyzygyPath` at them; out of scope for this version.
- No rematch button yet; user goes back to the lobby and starts a new
  game.

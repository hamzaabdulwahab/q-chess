# Q-Chess Gameplay Reliability Design

## Context

Q-Chess is a Next.js App Router chess app using React 19, TypeScript, Supabase Auth/Database/Realtime, `chess.js`, and a server-side Stockfish 18 path. The board route already supports local play, authenticated games, multiplayer, invitations, draw/resign flows, themes, sounds, move history, clocks, and Stockfish bot games.

This pass comes before the UI revamp. Its purpose is to make the board state stable enough that visual QA is trustworthy.

## Scope

Pass 1 focuses on:

- Play vs Stockfish color selection and automatic max-strength engine settings.
- Stockfish turn triggering, input locking, thinking state, and move application.
- Human move persistence and optimistic UI reconciliation.
- Multiplayer realtime broadcast and database fallback sync.
- Production reliability for Stockfish, Supabase writes, subscriptions, and build checks.

This pass does not redesign the main UI. It may make small UI changes when needed for state clarity, such as disabling board input or showing bot thinking.

## Current Findings

The bot modal already exposes only White, Black, and Random. The bot creation API defaults omitted or invalid levels to `monster`, and the Stockfish engine uses full-strength settings for `monster`: `UCI_LimitStrength=false`, `Skill Level=20`, and a short movetime for fast practical play.

The remaining move rollback risk is sync sequencing, not the difficulty UI. Current code has optimistic client moves, a human move RPC path, a separate bot move insert/update path, broadcast fast-path updates, and postgres-change fallback reloads. One concrete bug is that outgoing multiplayer broadcasts set `payload.player` to the next side to move instead of the side that just moved. Receivers can briefly apply the wrong turn and move owner before the database fallback corrects it, which looks like an undo/redo or bad sync.

The bot path also inserts a move and then updates the game row in separate statements. If a failure, retry, resign, draw, or duplicate request lands between those writes, the game can temporarily expose partial state.

## Chosen Approach

Use a targeted reliability patch. Keep the current architecture, API routes, and Supabase data model where possible. Harden the move pipeline around clear ownership, idempotency, and stale-event rejection rather than rewriting the app.

Rejected alternatives:

- A central move pipeline rewrite would be cleaner long-term but has too much blast radius for multiplayer and bot flows.
- A UI-only masking pass would improve perceived polish but would not fix the root rollback and duplicate-apply risks.

## Move Source Of Truth

The database game row and ordered moves table remain authoritative. Client state may be optimistic, but it must not overwrite newer authoritative state.

Rules:

- Each applied move advances one ply and one `games.move_count`.
- Client optimistic state is accepted only until a confirmed response, matching realtime payload, or fresh game row arrives.
- Any event with an older or equal move number is ignored.
- Any event for a different game id is ignored.
- Any stale fetch that does not match the expected optimistic FEN or next turn is ignored while the optimistic guard is active.
- Bot games do not use multiplayer broadcast for bot moves.

## Human Move Flow

The board applies a legal user move optimistically for responsiveness, then persists it through the existing `/api/games/[id]/moves` path.

Required changes:

- Track a local move-in-flight state so repeated clicks cannot submit multiple human moves before persistence settles.
- Pass `clientMoveId`, `expectedPly`, and `prevFen` to the existing move API so the server can reject duplicate or stale submissions.
- Clear optimistic guards only after a server success, a matching authoritative reload, or a real rejection.
- Revert only on illegal move, stale position conflict, auth failure, or final server rejection after retries.
- Keep promotion flow intact.

## Multiplayer Realtime Flow

Supabase Broadcast remains the fast-path for opponent moves, with Postgres Changes as fallback. This matches current Supabase guidance: Broadcast is recommended for scale and security, while Postgres Changes is simpler but less scalable and requires publication setup.

Required changes:

- Fix outgoing broadcast `player` to be the side that moved.
- Keep `currentTurn` derived from `player`, not from a mislabeled next-turn value.
- Dedupe by `moveNumber` and ignore self-originated payloads.
- Subscribe only after a valid game id is known.
- Remove the channel on game id changes and unmount.
- Keep postgres-change reloads as authoritative reconciliation, but reject stale snapshots using expected FEN, expected turn, and move count.

## Stockfish Flow

Play vs Stockfish should show only:

- White
- Black
- Random

The client sends only the color choice. The server resolves Random, stores the human side and bot side, and uses `monster` internally unless a future hidden compatibility path passes a valid level.

If the user is Black, the board loads with Stockfish to move and automatically triggers the first bot move.

Required changes:

- Keep all public difficulty UI hidden or removed.
- Keep `monster` as the default and strongest practical level.
- Use the existing server-side Stockfish singleton and FIFO queue so the UI thread does not block.
- Keep bot request retries tight only for expected 409 races while the human move is still committing.
- Disable board input while Stockfish is thinking.
- Re-enable input only after the bot move is applied or a clear error state is reached.

## Bot Move Persistence

Bot moves should be atomic or effectively atomic from the user perspective.

Required changes:

- Persist bot move and game-row update under the same database lock or through a dedicated RPC/migration if needed.
- Guard by game id, active status, bot mode, bot side, current player, and current move count.
- Reject duplicate bot requests for the same position or stale move count.
- Return the authoritative FEN, SAN, UCI, next player, move number, status, and winner.
- Avoid leaving a move row inserted without the matching game row update.

If schema changes are required, add a new numbered migration instead of editing old migrations.

## Production Reliability

Checks:

- Stockfish route must stay Node.js runtime because the engine uses Node process APIs.
- WASM engine fallback must work from the production build path.
- Supabase server and browser clients must keep service-role operations server-side only.
- No noisy console logs during normal gameplay.
- No unhandled promise rejections from Stockfish requests, broadcasts, or reloads.
- Auth and access-denied states remain explicit.

## Validation Plan

Commands:

- `npm run lint`
- `npx tsc --noEmit` if no dedicated typecheck script exists
- `npm run build`
- `npm run dev` or `npm run dev:turbopack`

Manual checks:

- Start Play vs Stockfish as White.
- Start Play vs Stockfish as Black and verify Stockfish moves first.
- Start Play vs Stockfish as Random several times and verify color assignment and first mover.
- Try rapid repeated clicks during human and bot turns.
- Verify promotion still works.
- Verify check, checkmate, stalemate, draw, resignation, and game-over display.
- Leave a game and start a new game.
- Verify multiplayer move sync does not double-apply or display wrong turn.
- Check console for errors and warnings during normal play.

Browser checks:

- Bot modal shows White, Black, Random only.
- No difficulty labels or buttons appear.
- Board is disabled while Stockfish is thinking.
- Stockfish response applies smoothly without visible rollback.
- Desktop and mobile board interactions remain usable.

## Risks

The board page is state-heavy and already mixes local board state, API persistence, realtime events, and bot automation. Changes should be narrow and covered by browser testing. Database RPC changes are higher risk than client fixes, so they should be introduced only if the existing bot persistence path cannot be made safe with current constraints.

# Q-Chess UI Revamp Design

## Context

Q-Chess is a Next.js App Router chess platform using React 19, TypeScript, Tailwind CSS v4, Supabase Auth/Database/Realtime/Storage, `chess.js`, and a server-side Stockfish 18 bot path. The main routes are `/`, `/board`, `/archive`, `/profile`, `/auth/signin`, and `/auth/signup`. API routes cover games, moves, bot moves, resign/draw, invites, profile, avatar upload, user search, profile creation, and keep-alive.

The current board screen already contains critical game behavior: legal move handling, optimistic move persistence, realtime broadcast sync, local hot-seat play, remote multiplayer, draw offers, resignations, player clocks, Stockfish turns, theme persistence, sound controls, move history, access-denial handling, offline protection, and game-over display. The revamp must preserve these behaviors.

## Product Direction

Use Chess.com only as structural UX inspiration: centered board, strong player cards and clocks, left navigation, compact right game panel, readable move history, obvious game actions, and mobile drawer behavior. Do not use Chess.com logos, names, assets, exact branding, or pixel-level replication.

Q-Chess keeps its own color identity. The existing dark graphite palette and current token vocabulary remain the base. Adjust tokens only to improve hierarchy, contrast, consistency, and state clarity. Accent usage should feel like Q-Chess, not a Chess.com clone.

## Chosen Approach

Implement a full platform shell rather than a board-only skin. This gives the app a shipped product feel across gameplay, lobby, archive, profile, and auth while keeping risk controlled by preserving the current data and chess logic.

Rejected alternatives:

- Board-only revamp: lower risk, but the rest of the app would still feel inconsistent.
- Deep rewrite: more freedom, but too much risk for multiplayer and Stockfish flows.

## Information Architecture

Create a reusable app-shell vocabulary:

- Left desktop sidebar: Q-Chess mark, Play/Lobby, Board, Archive, Profile, compact secondary controls.
- Mobile top bar: Q-Chess mark, current section, menu/action affordance.
- Main content region: route-specific content with tight, task-first spacing.
- Right game panel on board route: tabs for Moves, Game, and Analysis when analysis rows or review affordances exist.
- Mobile game drawer: move history and game actions in a bottom sheet or drawer, not a fixed side panel.

## Main Game Screen

Desktop layout:

- Left sidebar is persistent and compact.
- Center stage owns the board and never competes with surrounding panels.
- Opponent player card sits directly above the board.
- User player card sits directly below the board.
- Clocks are large, tabular, high-contrast, and visually attached to each player.
- Captured pieces stay in player rows with material delta.
- Right panel is fixed-width, compact, and scannable.
- Game actions are visible in the right panel, not buried only in the hamburger menu.
- Game-over modal keeps result, reason, new game, lobby, board view, and review/analysis affordance where supported.

Mobile layout:

- Compact top bar.
- Opponent card, board, user card, bottom action bar.
- Board uses nearly full viewport width and remains square.
- Moves/actions open in a bottom drawer.
- No horizontal overflow.
- Controls remain finger-sized without crowding the board.

## Supporting Screens

Lobby:

- Keep online presence, challenge by username, invitations, bot game creation, local game creation, active game resume, recent games, filters, and deletion.
- Replace generic page framing with a platform home: play commands, matchmaking/online players, active game status, and recent game rows/cards.
- Avoid a marketing hero.

Archive:

- Keep filters, search, stats, refresh, delete, and game open behavior.
- Use dense match rows/cards, clear status chips, and the same shell.

Profile:

- Keep full name edit, password change, avatar upload/remove, dirty navigation guard, logout, and error/success messaging.
- Use clearer form sections and aligned actions.

Auth:

- Keep sign-in/sign-up validation, Supabase flows, remember-me, username suggestions, and profile creation.
- Preserve the chessgrid mood but align forms and controls with the revised tokens.

## Components

Create or refactor only where useful:

- `ChessLayout` or route-level shell wrapper for sidebar/topbar structure.
- `SidebarNav` for desktop navigation.
- `GameBoardShell` for the board route composition.
- `PlayerCard` and a clearer `GameClock` substructure.
- `MoveHistoryPanel` extending current `MoveHistory`.
- `GameActions` reusing existing resign/draw APIs.
- `GameOverModal` behavior through existing `GameEndScreen`.
- `AnalysisPanel` as a non-cheating review surface only for completed games or existing analysis data.
- `BotSelector`, `MatchmakingCard`, and `ThemeSelector` refinements, preserving current API contracts.

Do not introduce unnecessary packages. Continue using `lucide-react` for icons.

## Design Tokens

Keep the current dark Q-Chess palette, then normalize semantic tokens:

- App background, sidebar background, panel background, elevated surface.
- Text primary, secondary, muted, disabled.
- Subtle and strong borders.
- Accent, accent hover, success, warning, danger.
- Board light/dark square tokens remain theme-driven through `theme-context`.
- Radius scale stays compact, generally 4 to 8 px for product controls.
- Shadows stay restrained.
- Focus rings must be visible and consistent.

Tailwind v4 remains CSS-first via `src/app/globals.css`.

## State And Data Flow

No database schema changes are planned.

Preserved flows:

- Supabase Auth and profile hydration.
- `/api/games` list/create/delete.
- `/api/games/[id]` load.
- `/api/games/[id]/moves` validation and persistence.
- Supabase Realtime broadcast for multiplayer moves.
- Invite creation, inbox, accept/decline/cancel, and redirect.
- Stockfish bot creation and `/bot-move` server path.
- Draw offer and resign endpoints.
- Theme and sound persistence.
- Profile avatar storage.

UI refactors must not move server-only code into client components.

## Error, Empty, And Loading States

Use route-specific skeletons or compact loading panels where feasible. Keep current fallback `LoadingSpinner` only where a route truly has no content yet. Empty states should say what can be done next, such as start a game, challenge a player, or adjust filters. Error messages should stay inline unless they block the board.

## Accessibility

Use semantic buttons and links. Maintain keyboard access for menus, tabs, drawers, modals, and game actions. Preserve Escape behavior for dialogs. Add clear focus-visible states. Use `aria-live` for active clocks only where already appropriate. Do not hide critical game actions behind hover-only controls.

## Implementation Plan

1. Normalize tokens and shared shell styles in `globals.css`.
2. Build sidebar/topbar shell components.
3. Refactor `/board` composition around board center, player rows, right panel, and mobile drawer while preserving state and handlers.
4. Refine `PlayerCard`, clock styling, move history, game actions, game-over modal, theme selector, and bot/invite modals.
5. Apply shell and denser product styling to lobby, archive, profile, and auth.
6. Run lint/build checks.
7. Start the dev server and inspect desktop, tablet, and mobile with the browser.
8. Fix visual issues until board centering, clocks, spacing, move history, panels, and mobile layout are production-grade.

## Verification Plan

Commands:

- `npm run lint`
- `npm run build`
- `npm run dev`

Visual checks:

- Desktop board layout around 1366 px and 1920 px.
- Tablet layout around 900 px.
- Mobile layout around 390 px.
- Lobby, archive, profile, sign-in, sign-up.
- Modal and drawer states for new game, bot game, invites, draw offers, resign confirm, promotion, and game over.

Functional checks:

- Auth redirect behavior.
- New local game.
- Bot game as white and black.
- Legal and illegal board moves.
- Move history updates.
- Draw offer and resign controls remain reachable.
- Invite challenge/inbox UI remains reachable.
- Theme selector and sound controls remain reachable.

## Risks

The board page is large and state-heavy, so the implementation should avoid moving game logic during layout work. Existing uncommitted changes in `src/app/board/page.tsx` and `src/app/globals.css` must be preserved and incorporated. Analysis tables exist in migrations, but no active analysis UI route was found, so any analysis panel should be careful: it can expose completed-game review affordances or existing data, but must not become a live engine cheat surface.

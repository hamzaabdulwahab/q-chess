# Repository Guidelines

## Project Structure & Module Organization

This is a Next.js App Router chess application. UI pages and API endpoints live in `src/app`; API handlers use `route.ts` under paths such as `src/app/api/games/[id]/moves/route.ts`. Shared React UI belongs in `src/components`, while game, Supabase, multiplayer, sound, theme, and Stockfish logic belongs in `src/lib`. Shared TypeScript domain types live in `src/types`. Static assets are in `public`, including `public/pieces` and `public/sounds`. Database schema work is tracked in `supabase/migrations`; `schema.sql` is the consolidated schema reference.

## Build, Test, and Development Commands

- `npm install`: install dependencies from `package-lock.json`.
- `npm run dev`: start the local Next.js dev server.
- `npm run dev:turbopack`: start the dev server with Turbopack.
- `npm run build`: create a production build and run Next.js type checks.
- `npm run start`: serve the production build locally after `npm run build`.
- `npm run lint`: run the configured Next/TypeScript ESLint rules.

## Coding Style & Naming Conventions

Use TypeScript with `strict` mode and the `@/*` path alias for imports from `src`. Follow the existing React style: functional components, hooks, 2-space indentation, semicolons, and mostly double-quoted strings. Name components in PascalCase, for example `ChessBoard.tsx`; name utilities and service functions in camelCase. Keep API route files named `route.ts`, and keep feature-specific server logic in `src/lib` instead of duplicating it inside handlers.

## Testing Guidelines

No automated test framework is currently committed. Before opening a PR, run `npm run lint` and `npm run build`. For gameplay changes, manually verify sign-in, lobby loading, new games, bot moves, legal and illegal board moves, resign/draw flows, invites, and archive filtering. If adding tests, colocate them with the feature using a clear `*.test.ts` or `*.test.tsx` suffix and document any new test command in `package.json`.

## Commit & Pull Request Guidelines

Recent history uses short imperative subjects, often prefixed with `[Feat]`, `[Fix]`, `[Perf]`, or `[Chore]`, for example `[Fix] Bundle stockfish WASM into bot-move`. Keep commits focused and mention the user-visible behavior. PRs should include a concise summary, validation commands run, linked issues when applicable, screenshots for UI changes, and explicit notes for Supabase migrations or environment variable changes.

## Security & Configuration Tips

Start from `.env.example` when creating `.env.local`. Never commit Supabase keys, service role keys, or `CRON_SECRET`. Keep service-role operations server-side only. Add database changes as new numbered SQL migrations in `supabase/migrations` instead of editing old migrations.

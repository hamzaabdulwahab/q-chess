-- 0012_games_list_perf_indexes.sql
-- Performance indexes for the per-user game list and username lookups.
--
-- The game list selects games where the user participates in ANY of three roles
-- (user_id / white_user_id / black_user_id) and orders by updated_at desc. The
-- single-column FK indexes from 0001 cannot satisfy both the OR-filter and the
-- ORDER BY together, and the 0011 composites carry `status` in the middle so
-- they do not apply to the status-agnostic list. These (role, updated_at desc)
-- indexes let the planner combine three already-sorted index ranges and skip
-- the explicit sort. The white/black indexes are partial because those roles
-- are frequently null (single-player and bot games).
--
-- For very large live tables prefer CREATE INDEX CONCURRENTLY (which cannot run
-- inside a transaction). These use plain CREATE INDEX IF NOT EXISTS to match the
-- project's migration convention and because they are safe on small/idle tables.

create index if not exists idx_games_user_updated
  on public.games(user_id, updated_at desc);

create index if not exists idx_games_white_updated
  on public.games(white_user_id, updated_at desc)
  where white_user_id is not null;

create index if not exists idx_games_black_updated
  on public.games(black_user_id, updated_at desc)
  where black_user_id is not null;

-- "Newest games" / archive orderings that key on created_at (the column is
-- returned in list payloads but was previously unindexed).
create index if not exists idx_games_created_at
  on public.games(created_at desc);

-- Case-insensitive username search (searchUsers ILIKE 'prefix%') and invite
-- resolution (createInvite ILIKE exact). The case-sensitive UNIQUE btree from
-- 0001 cannot serve ILIKE, so those queries previously sequentially scanned
-- profiles. A trigram GIN index supports both prefix and exact ILIKE patterns.
create extension if not exists pg_trgm;

create index if not exists idx_profiles_username_trgm
  on public.profiles using gin (username gin_trgm_ops);

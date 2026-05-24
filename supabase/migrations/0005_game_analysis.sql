-- Game review: per-game and per-move engine analysis, plus two stealth
-- columns the bot-move route already writes to but were never declared.

-- ------------------------------------------------------------------
-- moves.uci / moves.played_by: shipped in code, never in schema.
-- Adding here so future inserts stop silently dropping these columns.
-- ------------------------------------------------------------------
alter table public.moves add column if not exists uci text;
alter table public.moves add column if not exists played_by text;

-- ------------------------------------------------------------------
-- game_analyses: one row per fully-analyzed game.
-- ------------------------------------------------------------------
create table if not exists public.game_analyses (
  game_id             bigint primary key references public.games(id) on delete cascade,
  accuracy_white      numeric(5,2),
  accuracy_black      numeric(5,2),
  perf_elo_white      int,
  perf_elo_black      int,
  engine_movetime_ms  int  not null,
  engine_depth_hint   int,
  analyzed_at         timestamptz not null default timezone('utc', now()),
  analyzed_by         uuid references auth.users(id) on delete set null
);

-- ------------------------------------------------------------------
-- move_analyses: one row per ply, joined on (game_id, move_number)
-- to public.moves.
-- ------------------------------------------------------------------
create table if not exists public.move_analyses (
  game_id          bigint  not null references public.games(id) on delete cascade,
  move_number      int     not null,
  eval_cp          int,
  eval_mate        int,
  best_move_uci    text    not null,
  best_move_san    text    not null,
  classification   text    not null
    check (classification in (
      'brilliant','great','best','excellent','good','book',
      'inaccuracy','mistake','blunder','miss'
    )),
  delta_ep         numeric(6,4) not null,
  pv_uci           text,
  primary key (game_id, move_number)
);

create index if not exists idx_move_analyses_game on public.move_analyses(game_id);

-- ------------------------------------------------------------------
-- RLS: a user can read analysis rows for any game they can read.
-- Writes happen only from the server-side analyze route, which uses
-- the caller's JWT — the RLS policy below permits inserts/updates for
-- any participant of the game.
-- ------------------------------------------------------------------
alter table public.game_analyses enable row level security;
alter table public.move_analyses enable row level security;

drop policy if exists game_analyses_select on public.game_analyses;
create policy game_analyses_select on public.game_analyses for select
  using (
    exists (
      select 1 from public.games g
      where g.id = game_id
        and (
          g.user_id        = auth.uid()
          or g.white_user_id = auth.uid()
          or g.black_user_id = auth.uid()
        )
    )
  );

drop policy if exists game_analyses_insert on public.game_analyses;
create policy game_analyses_insert on public.game_analyses for insert
  with check (
    exists (
      select 1 from public.games g
      where g.id = game_id
        and (
          g.user_id        = auth.uid()
          or g.white_user_id = auth.uid()
          or g.black_user_id = auth.uid()
        )
    )
  );

drop policy if exists move_analyses_select on public.move_analyses;
create policy move_analyses_select on public.move_analyses for select
  using (
    exists (
      select 1 from public.games g
      where g.id = game_id
        and (
          g.user_id        = auth.uid()
          or g.white_user_id = auth.uid()
          or g.black_user_id = auth.uid()
        )
    )
  );

drop policy if exists move_analyses_insert on public.move_analyses;
create policy move_analyses_insert on public.move_analyses for insert
  with check (
    exists (
      select 1 from public.games g
      where g.id = game_id
        and (
          g.user_id        = auth.uid()
          or g.white_user_id = auth.uid()
          or g.black_user_id = auth.uid()
        )
    )
  );

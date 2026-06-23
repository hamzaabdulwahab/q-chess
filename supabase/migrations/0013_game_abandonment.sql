-- 0013_game_abandonment.sql
-- Mid-game abandonment forfeiture.
--
-- Adds a terminal 'abandoned' status plus a per-participant presence heartbeat
-- stored in a SEPARATE table (NOT columns on `games`) so heartbeats do not fire
-- the games updated_at trigger and spam realtime / reorder game lists every few
-- seconds. The maintenance sweep forfeits the side-to-move when their heartbeat
-- has gone silent past the opening.

alter table public.games
  drop constraint if exists games_status_check;

alter table public.games
  add constraint games_status_check
  check (status in (
    'active','checkmate','stalemate','draw','resigned','timeout','aborted','abandoned'
  ));

create table if not exists public.game_presence (
  game_id      bigint not null references public.games(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  color        text not null check (color in ('white','black')),
  last_seen_at timestamptz not null default timezone('utc', now()),
  primary key (game_id, user_id)
);

create index if not exists idx_game_presence_game on public.game_presence(game_id);

-- Lock the table down: only the SECURITY DEFINER heartbeat RPC (which runs as
-- the owner) writes it, and the service-role maintenance sweep reads it. Enable
-- RLS with NO policies so no direct client access is possible.
alter table public.game_presence enable row level security;

do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname='public' and tablename='game_presence'
  loop
    execute format('drop policy if exists %I on public.game_presence', r.policyname);
  end loop;
end;
$$;

-- Participant heartbeat. SECURITY DEFINER so it can write game_presence past
-- RLS, but it only ever stamps the CALLER's own colour for a game they actually
-- participate in.
create or replace function public.heartbeat_game(p_game_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_white uuid;
  v_black uuid;
  v_color text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return;
  end if;

  select white_user_id, black_user_id into v_white, v_black
  from public.games
  where id = p_game_id and status = 'active';

  if not found then
    return;
  end if;

  if v_user_id = v_white then
    v_color := 'white';
  elsif v_user_id = v_black then
    v_color := 'black';
  else
    return;
  end if;

  insert into public.game_presence (game_id, user_id, color, last_seen_at)
  values (p_game_id, v_user_id, v_color, timezone('utc', now()))
  on conflict (game_id, user_id)
  do update set last_seen_at = timezone('utc', now()), color = excluded.color;
end;
$$;

alter function public.heartbeat_game(bigint) owner to postgres;
revoke all on function public.heartbeat_game(bigint) from public, anon;
grant execute on function public.heartbeat_game(bigint) to authenticated;

-- Supports the abandonment sweep (active two-player games past the opening).
create index if not exists idx_games_active_multiplayer_abandon
  on public.games(status, current_player, move_count)
  where status = 'active'
    and white_user_id is not null
    and black_user_id is not null
    and move_count >= 2;

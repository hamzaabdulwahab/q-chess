/*
  master_schema.sql
  Q-Chess Master Database Schema (Supabase / PostgreSQL)
  ------------------------------------------------------
  HISTORICAL REFERENCE — live schema is now managed in supabase/migrations/.
  This file is preserved as the pre-migration baseline; the same contents
  live verbatim in supabase/migrations/0001_baseline.sql. New schema deltas
  should be added as numbered migration files, not edited here.

  Apply this in the Supabase SQL editor once. It is idempotent: safe to re-run.

  Contents:
    1. Extensions
    2. Helper functions (updated_at trigger)
    3. profiles table + Row Level Security (RLS)
    4. games table + RLS with user ownership
    5. moves table + RLS with game ownership
    6. Storage (avatars bucket + policies)
    7. Legacy cleanup (remove deprecated columns / invites)
    8. Verification queries (commented)

  Notes:
    - Invites/online play were removed. A legacy removal section is included (commented).
    - Games are now owned by users (user_id column) with proper RLS policies for privacy.
    - Users can only see/modify their own games and related moves.
    - Row Level Security ensures data isolation at the database level.
*/

------------------------------------------------------------
-- 1. Extensions
------------------------------------------------------------
create extension if not exists pgcrypto;   -- For UUID generation if needed later

------------------------------------------------------------
-- 2. Helper: updated_at trigger function
------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer  -- Function runs with owner privileges
set search_path = public, pg_temp  -- Explicit search path for security
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

------------------------------------------------------------
-- 3. PROFILES
------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null unique
              check (username ~ '^[A-Za-z0-9_]{3,30}$'),
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now())
);

-- Add any columns that might be missing (idempotent)
alter table public.profiles
  add column if not exists full_name  text,
  add column if not exists avatar_url text,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

-- Updated_at trigger
drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Auto-create profile on new auth user (if not already installed)
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user cascade;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp  -- Explicit search path for security
as $$
declare
  desired text;
  fname   text;
begin
  desired := coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1));
  fname   := new.raw_user_meta_data->>'full_name';

  begin
    insert into public.profiles (id, username, full_name)
    values (new.id, desired, fname);
  exception when unique_violation then
    insert into public.profiles (id, username, full_name)
    values (
      new.id,
      desired || lpad(floor(random()*10000)::int::text, 4, '0'),
      fname
    )
    on conflict (id) do nothing;
  end;

  return new;
end;
$$;
alter function public.handle_new_user owner to postgres;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Signup validation RPC used before an auth user exists. It mirrors the
-- client-side checks and prevents PostgREST PGRST202 missing-function errors.
drop function if exists public.validate_user_signup(text, text);

create or replace function public.validate_user_signup(
  email text,
  password text
)
returns json
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(trim(coalesce(email, '')));
  v_password text := coalesce(password, '');
  v_errors text[] := array[]::text[];
begin
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    v_errors := array_append(v_errors, 'Please enter a valid email address.');
  end if;

  if length(v_password) < 8 then
    v_errors := array_append(v_errors, 'Password must be at least 8 characters.');
  end if;

  if v_password !~ '[a-z]' then
    v_errors := array_append(v_errors, 'Password must include a lowercase letter.');
  end if;

  if v_password !~ '[A-Z]' then
    v_errors := array_append(v_errors, 'Password must include an uppercase letter.');
  end if;

  if v_password !~ '[0-9]' then
    v_errors := array_append(v_errors, 'Password must include a number.');
  end if;

  if lower(v_password) = any(array[
    'password',
    'password123',
    '123456789',
    'qwerty123',
    'admin123',
    'letmein123',
    'welcome123',
    'password1',
    'abc123456',
    '123456abc',
    'passw0rd',
    'p@ssw0rd'
  ]) then
    v_errors := array_append(
      v_errors,
      'This password is too common. Please choose a more unique password.'
    );
  end if;

  return json_build_object(
    'valid', cardinality(v_errors) = 0,
    'errors', v_errors
  );
end;
$$;

revoke execute on function public.validate_user_signup(text, text) from public;
grant execute on function public.validate_user_signup(text, text) to anon, authenticated;

-- Enable Row Level Security
alter table public.profiles enable row level security;

-- Drop existing policies to avoid duplicates
do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname='public' and tablename='profiles'
  loop
    execute format('drop policy if exists %I on public.profiles', r.policyname);
  end loop;
end;
$$;

-- Policies
create policy profiles_select_public
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy profiles_insert_self
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy profiles_insert_trigger
  on public.profiles for insert
  to public
  with check (current_setting('request.jwt.claims', true) is null);

create policy profiles_update_self
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

------------------------------------------------------------
-- 4. GAMES
------------------------------------------------------------
create table if not exists public.games (
  id             bigserial primary key,
  fen            text not null,
  pgn            text,
  status         text not null default 'active'
                 check (status in ('active','checkmate','stalemate','draw','resigned','timeout')),
  current_player text not null default 'white'
                 check (current_player in ('white','black')),
  winner         text
                 check (winner is null or winner in ('white','black','draw')),
  move_count     int not null default 0,
  user_id        uuid references auth.users(id) on delete cascade,
  white_user_id  uuid references auth.users(id) on delete set null,
  black_user_id  uuid references auth.users(id) on delete set null,
  time_control_initial_ms int,
  increment_ms   int not null default 0,
  white_time_left_ms int,
  black_time_left_ms int,
  last_move_at   timestamptz,
  started_at     timestamptz,
  ended_at       timestamptz,
  result_reason  text,
  mode           text not null default 'human_vs_human',
  bot_side       text,
  bot_level      text,
  created_at     timestamptz not null default timezone('utc', now()),
  updated_at     timestamptz not null default timezone('utc', now())
);

-- Add user_id column if missing (for existing databases)
alter table public.games
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.games
  add column if not exists white_user_id uuid references auth.users(id) on delete set null,
  add column if not exists black_user_id uuid references auth.users(id) on delete set null,
  add column if not exists time_control_initial_ms int,
  add column if not exists increment_ms int not null default 0,
  add column if not exists white_time_left_ms int,
  add column if not exists black_time_left_ms int,
  add column if not exists last_move_at timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists ended_at timestamptz,
  add column if not exists result_reason text,
  add column if not exists mode text not null default 'human_vs_human',
  add column if not exists bot_side text,
  add column if not exists bot_level text;

alter table public.games
  drop constraint if exists games_mode_check,
  drop constraint if exists games_bot_side_check,
  drop constraint if exists games_bot_level_check;

alter table public.games
  alter column mode set default 'human_vs_human';

update public.games
set mode = 'human_vs_human'
where mode is null or mode = 'standard';

alter table public.games
  alter column mode set not null;

alter table public.games
  drop constraint if exists games_status_check;

alter table public.games
  drop constraint if exists games_clock_non_negative;

alter table public.games
  add constraint games_status_check
  check (status in ('active','checkmate','stalemate','draw','resigned','timeout'));

alter table public.games
  add constraint games_clock_non_negative
  check (
    (time_control_initial_ms is null or time_control_initial_ms between 60000 and 1800000)
    and increment_ms between 0 and 30000
    and (white_time_left_ms is null or white_time_left_ms >= 0)
    and (black_time_left_ms is null or black_time_left_ms >= 0)
  );

alter table public.games
  add constraint games_mode_check
  check (mode in ('human_vs_human', 'human_vs_stockfish'));

alter table public.games
  add constraint games_bot_side_check
  check (bot_side is null or bot_side in ('white', 'black'));

alter table public.games
  add constraint games_bot_level_check
  check (
    bot_level is null
    or bot_level in ('beginner', 'intermediate', 'advanced', 'master', 'monster')
  );

-- Add updated_at if missing
alter table public.games
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

-- Remove deprecated timer columns if they still exist
alter table if exists public.games drop column if exists white_time_ms;
alter table if exists public.games drop column if exists black_time_ms;

-- Updated_at trigger
drop trigger if exists trg_games_updated_at on public.games;
create trigger trg_games_updated_at
before update on public.games
for each row execute function public.set_updated_at();

-- RLS
alter table public.games enable row level security;

do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname='public' and tablename='games'
  loop
    execute format('drop policy if exists %I on public.games', r.policyname);
  end loop;
end;
$$;

-- User-specific policies for games (users can only see/modify their own games)
create policy games_select_participant
  on public.games for select
  to authenticated
  using (
    auth.uid() = user_id
    or auth.uid() = white_user_id
    or auth.uid() = black_user_id
  );

create policy games_insert_own
  on public.games for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and (
      (white_user_id is null and black_user_id is null)
      or auth.uid() = white_user_id
      or auth.uid() = black_user_id
    )
  );

create policy games_update_participant
  on public.games for update
  to authenticated
  using (
    auth.uid() = user_id
    or auth.uid() = white_user_id
    or auth.uid() = black_user_id
  )
  with check (
    auth.uid() = user_id
    or auth.uid() = white_user_id
    or auth.uid() = black_user_id
  );

create policy games_delete_own
  on public.games for delete
  to authenticated
  using (auth.uid() = user_id);

create index if not exists idx_games_updated_at on public.games(updated_at desc);
create index if not exists idx_games_user_id on public.games(user_id);
create index if not exists idx_games_white_user_id on public.games(white_user_id);
create index if not exists idx_games_black_user_id on public.games(black_user_id);
create index if not exists idx_games_mode on public.games(mode);

------------------------------------------------------------
-- 5. MOVES
------------------------------------------------------------
create table if not exists public.moves (
  id            bigserial primary key,
  game_id       bigint not null references public.games(id) on delete cascade,
  move_number   int not null,
  player        text not null check (player in ('white','black')),
  move_notation text not null,
  fen_before    text not null,
  fen_after     text not null,
  pgn           text,
  captured_piece text,
  is_check      boolean not null default false,
  is_checkmate  boolean not null default false,
  is_castling   boolean not null default false,
  is_en_passant boolean not null default false,
  is_promotion  boolean not null default false,
  uci           text,
  played_by     text not null default 'user',
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now())
);

alter table public.moves
  add column if not exists updated_at timestamptz not null default timezone('utc', now()),
  add column if not exists uci text,
  add column if not exists played_by text;

update public.moves
set played_by = 'user'
where played_by is null;

alter table public.moves
  alter column played_by set default 'user',
  alter column played_by set not null,
  drop constraint if exists moves_played_by_check,
  add constraint moves_played_by_check
  check (played_by in ('user', 'stockfish'));

drop trigger if exists trg_moves_updated_at on public.moves;
create trigger trg_moves_updated_at
before update on public.moves
for each row execute function public.set_updated_at();

alter table public.moves enable row level security;

do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname='public' and tablename='moves'
  loop
    execute format('drop policy if exists %I on public.moves', r.policyname);
  end loop;
end;
$$;

-- User-specific policies for moves (users can only see/modify moves for games they own)
create policy moves_select_participant_game
  on public.moves for select
  to authenticated
  using (
    exists (
      select 1 from public.games 
      where games.id = moves.game_id 
      and (
        games.user_id = auth.uid()
        or games.white_user_id = auth.uid()
        or games.black_user_id = auth.uid()
      )
    )
  );

create policy moves_insert_participant_game
  on public.moves for insert
  to authenticated
  with check (
    exists (
      select 1 from public.games 
      where games.id = moves.game_id 
      and (
        games.user_id = auth.uid()
        or games.white_user_id = auth.uid()
        or games.black_user_id = auth.uid()
      )
    )
  );

create policy moves_update_participant_game
  on public.moves for update
  to authenticated
  using (
    exists (
      select 1 from public.games 
      where games.id = moves.game_id 
      and (
        games.user_id = auth.uid()
        or games.white_user_id = auth.uid()
        or games.black_user_id = auth.uid()
      )
    )
  );

create policy moves_delete_participant_game
  on public.moves for delete
  to authenticated
  using (
    exists (
      select 1 from public.games 
      where games.id = moves.game_id 
      and (
        games.user_id = auth.uid()
        or games.white_user_id = auth.uid()
        or games.black_user_id = auth.uid()
      )
    )
  );

create index if not exists idx_moves_game_id on public.moves(game_id);
create index if not exists idx_moves_game_id_number on public.moves(game_id, move_number);

------------------------------------------------------------
-- 6. STORAGE (avatars bucket)
------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars','avatars', true)
on conflict (id) do nothing;

-- Drop old avatar policies
do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname='storage'
      and tablename='objects'
      and policyname like 'avatars_%'
  loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end;
$$;

create policy avatars_public_read
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'avatars');

create policy avatars_user_write
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and split_part(name,'/',1) = auth.uid()::text
  );

create policy avatars_user_update
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name,'/',1) = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and split_part(name,'/',1) = auth.uid()::text
  );

create policy avatars_user_delete
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name,'/',1) = auth.uid()::text
  );

------------------------------------------------------------
-- 7. INVITES (MULTIPLAYER)
------------------------------------------------------------
create table if not exists public.invites (
  id bigserial primary key,
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','accepted','declined','expired','cancelled')),
  time_control_initial_ms int not null default 600000
    check (time_control_initial_ms between 60000 and 1800000),
  increment_ms int not null default 0
    check (increment_ms between 0 and 30000),
  game_id bigint references public.games(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null default (timezone('utc', now()) + interval '15 minutes'),
  responded_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint invites_not_self check (from_user_id <> to_user_id)
);

alter table public.invites
  add column if not exists time_control_initial_ms int not null default 600000,
  add column if not exists increment_ms int not null default 0,
  add column if not exists game_id bigint references public.games(id) on delete set null,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists expires_at timestamptz not null default (timezone('utc', now()) + interval '15 minutes'),
  add column if not exists responded_at timestamptz,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

drop trigger if exists trg_invites_updated_at on public.invites;
create trigger trg_invites_updated_at
before update on public.invites
for each row execute function public.set_updated_at();

alter table public.invites enable row level security;

do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname='public' and tablename='invites'
  loop
    execute format('drop policy if exists %I on public.invites', r.policyname);
  end loop;
end;
$$;

create policy invites_select_participants
  on public.invites for select
  to authenticated
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

create policy invites_insert_sender
  on public.invites for insert
  to authenticated
  with check (
    auth.uid() = from_user_id
    and auth.uid() <> to_user_id
    and status = 'pending'
  );

create policy invites_update_participants
  on public.invites for update
  to authenticated
  using (auth.uid() = from_user_id or auth.uid() = to_user_id)
  with check (auth.uid() = from_user_id or auth.uid() = to_user_id);

create index if not exists idx_invites_to_user_status_created
  on public.invites(to_user_id, status, created_at desc);
create index if not exists idx_invites_from_user_status_created
  on public.invites(from_user_id, status, created_at desc);
create unique index if not exists idx_invites_unique_pending_pair
  on public.invites(least(from_user_id, to_user_id), greatest(from_user_id, to_user_id))
  where status = 'pending';

------------------------------------------------------------
-- 8. ATOMIC MOVE RECORDING FUNCTION
------------------------------------------------------------
-- Drop existing function first to handle return type changes
drop function if exists public.record_move(bigint, int, text, text, text, text, text, text, boolean, boolean, boolean, boolean, boolean, text, text, text, int);

create or replace function public.record_move(
  p_game_id bigint,
  p_move_number int,
  p_player text,
  p_move_notation text,
  p_fen_before text,
  p_fen_after text,
  p_pgn text,
  p_captured_piece text default null,
  p_is_check boolean default false,
  p_is_checkmate boolean default false,
  p_is_castling boolean default false,
  p_is_en_passant boolean default false,
  p_is_promotion boolean default false,
  p_current_player text default 'white',
  p_status text default 'active',
  p_winner text default null,
  p_expected_ply int default null
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_current_move_count int;
  v_owner_user_id uuid;
  v_white_user_id uuid;
  v_black_user_id uuid;
  v_current_player text;
  v_game_status text;
  v_actor_color text;
  v_result json;
begin
  -- Get the authenticated user
  v_user_id := auth.uid();
  if v_user_id is null then
    return json_build_object('success', false, 'error', 'Not authenticated');
  end if;

  -- Start transaction and lock the game for update
  perform pg_advisory_xact_lock(p_game_id);
  
  -- Verify game access and get current state
  select move_count, user_id, white_user_id, black_user_id, current_player, status
  into v_current_move_count, v_owner_user_id, v_white_user_id, v_black_user_id, v_current_player, v_game_status
  from public.games 
  where id = p_game_id
    and (
      user_id = v_user_id
      or white_user_id = v_user_id
      or black_user_id = v_user_id
    );
  
  if not found then
    return json_build_object('success', false, 'error', 'Game not found or access denied');
  end if;

  if v_game_status <> 'active' then
    return json_build_object('success', false, 'error', 'Game is not active');
  end if;

  -- For any fixed-color game, enforce side ownership and turn-taking.
  if v_white_user_id is not null or v_black_user_id is not null then
    v_actor_color := case
      when v_user_id = v_white_user_id then 'white'
      when v_user_id = v_black_user_id then 'black'
      else null
    end;

    if v_actor_color is null then
      return json_build_object('success', false, 'error', 'Only the assigned player can move');
    end if;

    if v_actor_color <> v_current_player then
      return json_build_object('success', false, 'error', 'It is not your turn');
    end if;

    if p_player <> v_current_player then
      return json_build_object('success', false, 'error', 'Move player mismatch');
    end if;
  end if;

  if p_expected_ply is not null and v_current_move_count <> p_expected_ply - 1 then
    return json_build_object(
      'success', false,
      'error', 'Move order conflict',
      'currentMoveCount', v_current_move_count
    );
  end if;
  
  -- Insert the move (using database's current move_count + 1 as the move_number)
  insert into public.moves (
    game_id, move_number, player, move_notation, fen_before, fen_after, pgn,
    captured_piece, is_check, is_checkmate, is_castling, is_en_passant, is_promotion
  ) values (
    p_game_id, v_current_move_count + 1, p_player, p_move_notation, p_fen_before, p_fen_after, p_pgn,
    p_captured_piece, p_is_check, p_is_checkmate, p_is_castling, p_is_en_passant, p_is_promotion
  );

  -- Update the game state
  update public.games 
  set 
    fen = p_fen_after,
    pgn = p_pgn,
    current_player = p_current_player,
    status = p_status,
    winner = p_winner,
    move_count = v_current_move_count + 1, -- Increment from current count
    last_move_at = timezone('utc', now()),
    ended_at = case when p_status <> 'active' then timezone('utc', now()) else ended_at end,
    result_reason = case when p_status <> 'active' then p_status else result_reason end,
    updated_at = timezone('utc', now())
  where id = p_game_id;

  -- Return success
  return json_build_object('success', true);
  
exception
  when others then
    return json_build_object('success', false, 'error', SQLERRM);
end;
$$;

-- Grant execute permission to authenticated users
revoke execute on function public.record_move(bigint, int, text, text, text, text, text, text, boolean, boolean, boolean, boolean, boolean, text, text, text, int) from anon, public;
grant execute on function public.record_move(bigint, int, text, text, text, text, text, text, boolean, boolean, boolean, boolean, boolean, text, text, text, int) to authenticated;

------------------------------------------------------------

drop function if exists public.record_bot_move(
  bigint,
  int,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  text,
  text,
  text,
  text
);

create or replace function public.record_bot_move(
  p_game_id bigint,
  p_expected_move_count int,
  p_player text,
  p_move_notation text,
  p_fen_before text,
  p_fen_after text,
  p_pgn text,
  p_captured_piece text default null,
  p_is_check boolean default false,
  p_is_checkmate boolean default false,
  p_is_castling boolean default false,
  p_is_en_passant boolean default false,
  p_is_promotion boolean default false,
  p_current_player text default 'white',
  p_status text default 'active',
  p_winner text default null,
  p_uci text default null
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_fen text;
  v_current_move_count int;
  v_owner_user_id uuid;
  v_white_user_id uuid;
  v_black_user_id uuid;
  v_current_player text;
  v_game_status text;
  v_mode text;
  v_bot_side text;
  v_move_number int;
  v_now timestamptz := timezone('utc', now());
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return json_build_object('success', false, 'error', 'Not authenticated');
  end if;

  perform pg_advisory_xact_lock(p_game_id);

  select
    fen,
    move_count,
    user_id,
    white_user_id,
    black_user_id,
    current_player,
    status,
    mode,
    bot_side
  into
    v_fen,
    v_current_move_count,
    v_owner_user_id,
    v_white_user_id,
    v_black_user_id,
    v_current_player,
    v_game_status,
    v_mode,
    v_bot_side
  from public.games
  where id = p_game_id
    and (
      user_id = v_user_id
      or white_user_id = v_user_id
      or black_user_id = v_user_id
    );

  if not found then
    return json_build_object('success', false, 'error', 'Game not found or access denied');
  end if;

  if p_expected_move_count is not null
     and v_current_move_count = p_expected_move_count + 1
     and v_fen = p_fen_after then
    return json_build_object(
      'success', true,
      'duplicate', true,
      'moveNumber', v_current_move_count
    );
  end if;

  if v_game_status <> 'active' then
    return json_build_object('success', false, 'error', 'Game is not active');
  end if;

  if v_mode <> 'human_vs_stockfish' or v_bot_side is null then
    return json_build_object('success', false, 'error', 'This is not a Stockfish game');
  end if;

  if p_player <> v_bot_side then
    return json_build_object('success', false, 'error', 'Bot side mismatch');
  end if;

  if v_current_player <> v_bot_side then
    return json_build_object('success', false, 'error', 'It is not the bot''s turn');
  end if;

  if p_expected_move_count is not null
     and v_current_move_count <> p_expected_move_count then
    return json_build_object(
      'success', false,
      'error', 'Move order conflict',
      'currentMoveCount', v_current_move_count
    );
  end if;

  if p_fen_before is not null and trim(p_fen_before) <> trim(v_fen) then
    return json_build_object('success', false, 'error', 'Position conflict: stale bot state');
  end if;

  v_move_number := v_current_move_count + 1;

  insert into public.moves (
    game_id,
    move_number,
    player,
    move_notation,
    fen_before,
    fen_after,
    pgn,
    captured_piece,
    is_check,
    is_checkmate,
    is_castling,
    is_en_passant,
    is_promotion,
    played_by,
    uci
  ) values (
    p_game_id,
    v_move_number,
    p_player,
    p_move_notation,
    p_fen_before,
    p_fen_after,
    p_pgn,
    p_captured_piece,
    p_is_check,
    p_is_checkmate,
    p_is_castling,
    p_is_en_passant,
    p_is_promotion,
    'stockfish',
    p_uci
  );

  update public.games
  set
    fen = p_fen_after,
    pgn = p_pgn,
    current_player = p_current_player,
    status = p_status,
    winner = p_winner,
    move_count = v_move_number,
    last_move_at = v_now,
    updated_at = v_now,
    ended_at = case when p_status <> 'active' then v_now else ended_at end,
    result_reason = case when p_status <> 'active' then p_status else result_reason end
  where id = p_game_id;

  return json_build_object(
    'success', true,
    'duplicate', false,
    'moveNumber', v_move_number
  );
exception
  when others then
    return json_build_object('success', false, 'error', SQLERRM);
end;
$$;

revoke execute on function public.record_bot_move(
  bigint,
  int,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  text,
  text,
  text,
  text
) from anon, public;

grant execute on function public.record_bot_move(
  bigint,
  int,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  text,
  text,
  text,
  text
) to authenticated;

------------------------------------------------------------
-- 9. VERIFICATION (Run manually as needed)
------------------------------------------------------------
-- select * from public.profiles limit 1;
-- select * from public.games limit 1;
-- select * from public.moves limit 1;
-- select policyname, tablename from pg_policies where schemaname='public';
-- select * from storage.buckets where id='avatars';

-- END OF master_schema.sql

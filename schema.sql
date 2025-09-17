/*
  master_schema.sql
  Q-Chess Master Database Schema (Supabase / PostgreSQL)
  ------------------------------------------------------
  This file replaces all previous per-table schema scripts (e.g.,
  deprecated: supabase_auth.sql, supabase_invites.sql, remove_timer_columns.sql).
  Apply this in the Supabase SQL editor once. It is idempotent: safe to re-run.

  Contents:
    1. Extensions
    2. Helper functions (updated_at trigger)
    3. profiles table + Row Level Security (RLS)
    4. games table + RLS
    5. moves table + RLS
    6. Storage (avatars bucket + policies)
    7. Legacy cleanup (remove deprecated columns / invites)
    8. Verification queries (commented)

  Notes:
    - Invites/online play were removed. A legacy removal section is included (commented).
    - Ownership for games is intentionally open (any authenticated user can manage).
      To lock games to creators, add a user_id column + adjust policies.
    - If you want strict auditing, add more columns (e.g., last_move_at, created_by).
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
set search_path = public
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
                 check (status in ('active','checkmate','stalemate','draw')),
  current_player text not null default 'white'
                 check (current_player in ('white','black')),
  winner         text
                 check (winner is null or winner in ('white','black','draw')),
  move_count     int not null default 0,
  created_at     timestamptz not null default timezone('utc', now()),
  updated_at     timestamptz not null default timezone('utc', now())
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

create policy games_select_public
  on public.games for select
  to anon, authenticated
  using (true);

create policy games_write_authenticated
  on public.games for all
  to authenticated
  using (true)
  with check (true);

create index if not exists idx_games_updated_at on public.games(updated_at desc);

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
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now())
);

alter table public.moves
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

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

create policy moves_select_public
  on public.moves for select
  to anon, authenticated
  using (true);

create policy moves_write_authenticated
  on public.moves for all
  to authenticated
  using (true)
  with check (true);

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
-- 7. LEGACY CLEANUP (INVITES REMOVAL)
------------------------------------------------------------
-- Actively drop deprecated invite artifacts (table, related view, policies) if they exist.
-- This block is safe (idempotent) and will not error if objects are already gone.
do $$
begin
  -- Drop legacy view (if it was ever created)
  begin
    execute 'drop view if exists public.invites_with_usernames cascade';
  exception when others then
    null;
  end;
  -- Drop invites table (and any dependent policies / triggers / indexes)
  begin
    execute 'drop table if exists public.invites cascade';
  exception when others then
    null;
  end;
end;
$$;

------------------------------------------------------------
-- 8. VERIFICATION (Run manually as needed)
------------------------------------------------------------
-- select * from public.profiles limit 1;
-- select * from public.games limit 1;
-- select * from public.moves limit 1;
-- select policyname, tablename from pg_policies where schemaname='public';
-- select * from storage.buckets where id='avatars';

-- END OF master_schema.sql

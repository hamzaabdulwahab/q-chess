-- Supabase Auth + Chess schema (idempotent)
-- Run this whole file in the Supabase SQL editor.

-- PROFILES
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone default now()
);

-- Ensure new columns exist for existing databases
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists avatar_url text;

alter table public.profiles enable row level security;

-- Drop and recreate policies to avoid duplicate errors
drop policy if exists profiles_select_authenticated on public.profiles;
drop policy if exists profiles_select_public on public.profiles;
drop policy if exists profiles_insert_self on public.profiles;
drop policy if exists profiles_insert_trigger on public.profiles;
drop policy if exists profiles_update_self on public.profiles;

-- Allow public read to check username availability during signup
create policy profiles_select_public
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy profiles_insert_self
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- Allow inserts from backend contexts without a JWT (e.g., our auth trigger)
create policy profiles_insert_trigger
  on public.profiles for insert
  to public
  with check (current_setting('request.jwt.claims', true) is null);

create policy profiles_update_self
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Auto-create profile on new auth user
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
  fname text;
begin
  desired := coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
  fname := new.raw_user_meta_data->>'full_name';
  begin
    insert into public.profiles (id, username, full_name)
    values (new.id, desired, fname);
  exception when unique_violation then
    -- If the desired username already exists, append random digits
    insert into public.profiles (id, username, full_name)
    values (
      new.id,
      desired || lpad(floor(random() * 10000)::int::text, 4, '0'),
      fname
    )
    on conflict (id) do nothing;
  end;
  return new;
end;
$$;

-- Ensure the function owner can bypass RLS in Supabase
alter function public.handle_new_user owner to postgres;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- GAMES
create table if not exists public.games (
  id bigserial primary key,
  fen text not null,
  pgn text,
  status text not null default 'active',
  current_player text not null default 'white',
  winner text,
  move_count int not null default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.games enable row level security;

drop policy if exists games_select_public on public.games;
drop policy if exists games_write_authenticated on public.games;

create policy games_select_public
  on public.games for select
  to anon, authenticated
  using (true);

create policy games_write_authenticated
  on public.games for all
  to authenticated
  using (true)
  with check (true);

-- MOVES
create table if not exists public.moves (
  id bigserial primary key,
  game_id bigint not null references public.games(id) on delete cascade,
  move_number int not null,
  player text not null,
  move_notation text not null,
  fen_before text not null,
  fen_after text not null,
  pgn text,
  captured_piece text,
  is_check boolean not null default false,
  is_checkmate boolean not null default false,
  is_castling boolean not null default false,
  is_en_passant boolean not null default false,
  is_promotion boolean not null default false,
  created_at timestamp with time zone default now()
);

alter table public.moves enable row level security;

drop policy if exists moves_select_public on public.moves;
drop policy if exists moves_write_authenticated on public.moves;

create policy moves_select_public
  on public.moves for select
  to anon, authenticated
  using (true);

create policy moves_write_authenticated
  on public.moves for all
  to authenticated
  using (true)
  with check (true);

-- Indexes
create index if not exists idx_moves_game_id on public.moves(game_id);
create index if not exists idx_moves_game_id_num on public.moves(game_id, move_number);

-- STORAGE: Avatars bucket and policies (idempotent)
-- Create a public avatars bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Drop existing policies to avoid duplicates
drop policy if exists avatars_public_read on storage.objects;
drop policy if exists avatars_user_write on storage.objects;
drop policy if exists avatars_user_update on storage.objects;
drop policy if exists avatars_user_delete on storage.objects;

-- Public read access for avatars
create policy avatars_public_read
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'avatars');

-- Only allow authenticated users to write to their own folder `${auth.uid()}/...`
create policy avatars_user_write
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy avatars_user_update
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy avatars_user_delete
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

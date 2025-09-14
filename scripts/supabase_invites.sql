-- Invites table and RLS for friend matchmaking
-- Run this in Supabase SQL editor or psql against your Supabase project.

-- Ensure extensions
create extension if not exists pgcrypto;

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  room_id text not null,
  status text not null check (status in ('pending','accepted','declined','expired')) default 'pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  declined_at timestamptz
);

alter table public.invites enable row level security;

-- Only inviter can insert
create policy invite_insert on public.invites
  for insert to authenticated
  with check (auth.uid() = from_user);

-- Both parties can read
create policy invite_select on public.invites
  for select to authenticated
  using (auth.uid() = from_user or auth.uid() = to_user);

-- Recipient can update to accepted/declined while pending and not expired
create policy invite_update_recipient on public.invites
  for update to authenticated
  using (
    auth.uid() = to_user and status = 'pending' and now() < expires_at
  )
  with check (
    auth.uid() = to_user and status in ('accepted','declined')
  );

-- Optional: inviter can mark expired (or use a scheduled job); we rely on expires_at checks in app.

-- Enable Realtime
-- In Supabase dashboard, turn on Realtime for table public.invites.

-- 0003_invite_ttl_outgoing_cap_and_draw.sql
-- Three changes bundled:
--   (1) Tighten invite TTL from 15 minutes to 60 seconds per the spec
--   (2) Cap pending outgoing invites to 5 per sender (spam control)
--   (3) Add games.pending_draw_offer_by column for draw offer / response

-- (1) 60s default TTL
alter table public.invites
  alter column expires_at set default (timezone('utc', now()) + interval '60 seconds');

-- (2) Outgoing invite cap (5 pending per sender). Raises P0001 which the
-- API layer maps to a 429-equivalent error message for the client.
create or replace function public.enforce_outgoing_invite_cap()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
begin
  select count(*) into v_count
  from public.invites
  where from_user_id = new.from_user_id
    and status = 'pending'
    and expires_at > timezone('utc', now());

  if v_count >= 5 then
    raise exception 'OUTGOING_INVITE_CAP_REACHED' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_outgoing_invite_cap on public.invites;
create trigger trg_outgoing_invite_cap
before insert on public.invites
for each row when (new.status = 'pending')
execute function public.enforce_outgoing_invite_cap();

-- (3) Draw offers: null = no pending offer; otherwise = the uid that offered.
alter table public.games
  add column if not exists pending_draw_offer_by uuid references auth.users(id) on delete set null;

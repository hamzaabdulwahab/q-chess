-- Collapse the two permissive INSERT policies on public.profiles into
-- a single policy so Postgres only evaluates one rule per insert
-- (resolves the `multiple_permissive_policies` advisor). The merged
-- policy accepts both legitimate paths:
--   1. The signup trigger (`handle_new_user`) — runs without a JWT.
--   2. A signed-in user inserting their own row.

drop policy if exists profiles_insert_self on public.profiles;
drop policy if exists profiles_insert_trigger on public.profiles;

create policy profiles_insert on public.profiles for insert
  with check (
    (select current_setting('request.jwt.claims', true)) is null
    or (select auth.uid()) = id
  );

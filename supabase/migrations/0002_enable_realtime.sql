-- 0002_enable_realtime.sql
-- Add game-loop tables to the Supabase Realtime publication so
-- postgres_changes events actually fire for clients subscribed to:
--   - games        (board state, status, clocks)
--   - invites      (incoming/outgoing challenge stream)
--   - moves        (optional — most clients refetch the game row instead)
--
-- Idempotent: safe to re-run. Adding a table already in the publication
-- would error, so we guard via pg_publication_tables.

do $$
declare
  tbl text;
begin
  foreach tbl in array array['games', 'invites', 'moves']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = tbl
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        tbl
      );
    end if;
  end loop;
end $$;

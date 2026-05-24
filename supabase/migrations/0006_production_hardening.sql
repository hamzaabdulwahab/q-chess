-- Production-hardening pass driven by Supabase advisors:
--
--   1. Every RLS policy that calls `auth.uid()` is rewritten to use
--      `(select auth.uid())`. Without the subquery wrapping, Postgres
--      re-evaluates the function once per row instead of once per query
--      (advisor: auth_rls_initplan). This is a no-op for correctness
--      and substantially cheaper at scale.
--
--   2. Indexes are added on the three foreign-key columns that lacked
--      a covering index (advisor: unindexed_foreign_keys). Each one is
--      used as an FK target in cascading deletes or joins.
--
--   3. EXECUTE on `public.record_move(...)` is revoked from `anon`.
--      It is a SECURITY DEFINER function meant only for authenticated
--      participants of a game (advisor:
--      anon_security_definer_function_executable).

-- ──────────────────────────────────────────────────────────────────
-- 1. RLS policies rewritten with `(select auth.uid())`
-- ──────────────────────────────────────────────────────────────────

-- ── games ────────────────────────────────────────────────────────
drop policy if exists games_select_participant on public.games;
create policy games_select_participant on public.games for select
  using (
    (select auth.uid()) = user_id
    or (select auth.uid()) = white_user_id
    or (select auth.uid()) = black_user_id
  );

drop policy if exists games_insert_own on public.games;
create policy games_insert_own on public.games for insert
  with check (
    (select auth.uid()) = user_id
    and (
      (white_user_id is null and black_user_id is null)
      or (select auth.uid()) = white_user_id
      or (select auth.uid()) = black_user_id
    )
  );

drop policy if exists games_update_participant on public.games;
create policy games_update_participant on public.games for update
  using (
    (select auth.uid()) = user_id
    or (select auth.uid()) = white_user_id
    or (select auth.uid()) = black_user_id
  )
  with check (
    (select auth.uid()) = user_id
    or (select auth.uid()) = white_user_id
    or (select auth.uid()) = black_user_id
  );

drop policy if exists games_delete_own on public.games;
create policy games_delete_own on public.games for delete
  using ((select auth.uid()) = user_id);

-- ── moves ────────────────────────────────────────────────────────
drop policy if exists moves_select_participant_game on public.moves;
create policy moves_select_participant_game on public.moves for select
  using (
    exists (
      select 1 from public.games g
      where g.id = moves.game_id
        and (
          g.user_id = (select auth.uid())
          or g.white_user_id = (select auth.uid())
          or g.black_user_id = (select auth.uid())
        )
    )
  );

drop policy if exists moves_insert_participant_game on public.moves;
create policy moves_insert_participant_game on public.moves for insert
  with check (
    exists (
      select 1 from public.games g
      where g.id = moves.game_id
        and (
          g.user_id = (select auth.uid())
          or g.white_user_id = (select auth.uid())
          or g.black_user_id = (select auth.uid())
        )
    )
  );

drop policy if exists moves_update_participant_game on public.moves;
create policy moves_update_participant_game on public.moves for update
  using (
    exists (
      select 1 from public.games g
      where g.id = moves.game_id
        and (
          g.user_id = (select auth.uid())
          or g.white_user_id = (select auth.uid())
          or g.black_user_id = (select auth.uid())
        )
    )
  );

drop policy if exists moves_delete_participant_game on public.moves;
create policy moves_delete_participant_game on public.moves for delete
  using (
    exists (
      select 1 from public.games g
      where g.id = moves.game_id
        and (
          g.user_id = (select auth.uid())
          or g.white_user_id = (select auth.uid())
          or g.black_user_id = (select auth.uid())
        )
    )
  );

-- ── invites ──────────────────────────────────────────────────────
drop policy if exists invites_select_participants on public.invites;
create policy invites_select_participants on public.invites for select
  using (
    (select auth.uid()) = from_user_id
    or (select auth.uid()) = to_user_id
  );

drop policy if exists invites_insert_sender on public.invites;
create policy invites_insert_sender on public.invites for insert
  with check (
    (select auth.uid()) = from_user_id
    and (select auth.uid()) <> to_user_id
    and status = 'pending'
  );

drop policy if exists invites_update_participants on public.invites;
create policy invites_update_participants on public.invites for update
  using (
    (select auth.uid()) = from_user_id
    or (select auth.uid()) = to_user_id
  )
  with check (
    (select auth.uid()) = from_user_id
    or (select auth.uid()) = to_user_id
  );

-- ── profiles ─────────────────────────────────────────────────────
drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles for insert
  with check ((select auth.uid()) = id);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ── game_analyses ────────────────────────────────────────────────
drop policy if exists game_analyses_select on public.game_analyses;
create policy game_analyses_select on public.game_analyses for select
  using (
    exists (
      select 1 from public.games g
      where g.id = game_analyses.game_id
        and (
          g.user_id = (select auth.uid())
          or g.white_user_id = (select auth.uid())
          or g.black_user_id = (select auth.uid())
        )
    )
  );

drop policy if exists game_analyses_insert on public.game_analyses;
create policy game_analyses_insert on public.game_analyses for insert
  with check (
    exists (
      select 1 from public.games g
      where g.id = game_analyses.game_id
        and (
          g.user_id = (select auth.uid())
          or g.white_user_id = (select auth.uid())
          or g.black_user_id = (select auth.uid())
        )
    )
  );

drop policy if exists game_analyses_update on public.game_analyses;
create policy game_analyses_update on public.game_analyses for update
  using (
    exists (
      select 1 from public.games g
      where g.id = game_analyses.game_id
        and (
          g.user_id = (select auth.uid())
          or g.white_user_id = (select auth.uid())
          or g.black_user_id = (select auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from public.games g
      where g.id = game_analyses.game_id
        and (
          g.user_id = (select auth.uid())
          or g.white_user_id = (select auth.uid())
          or g.black_user_id = (select auth.uid())
        )
    )
  );

-- ── move_analyses ────────────────────────────────────────────────
drop policy if exists move_analyses_select on public.move_analyses;
create policy move_analyses_select on public.move_analyses for select
  using (
    exists (
      select 1 from public.games g
      where g.id = move_analyses.game_id
        and (
          g.user_id = (select auth.uid())
          or g.white_user_id = (select auth.uid())
          or g.black_user_id = (select auth.uid())
        )
    )
  );

drop policy if exists move_analyses_insert on public.move_analyses;
create policy move_analyses_insert on public.move_analyses for insert
  with check (
    exists (
      select 1 from public.games g
      where g.id = move_analyses.game_id
        and (
          g.user_id = (select auth.uid())
          or g.white_user_id = (select auth.uid())
          or g.black_user_id = (select auth.uid())
        )
    )
  );

drop policy if exists move_analyses_delete on public.move_analyses;
create policy move_analyses_delete on public.move_analyses for delete
  using (
    exists (
      select 1 from public.games g
      where g.id = move_analyses.game_id
        and (
          g.user_id = (select auth.uid())
          or g.white_user_id = (select auth.uid())
          or g.black_user_id = (select auth.uid())
        )
    )
  );

-- ──────────────────────────────────────────────────────────────────
-- 2. Cover the unindexed foreign keys
-- ──────────────────────────────────────────────────────────────────

create index if not exists idx_game_analyses_analyzed_by
  on public.game_analyses(analyzed_by);

create index if not exists idx_games_pending_draw_offer_by
  on public.games(pending_draw_offer_by);

create index if not exists idx_invites_game_id
  on public.invites(game_id);

-- ──────────────────────────────────────────────────────────────────
-- 3. Lock down `record_move` — SECURITY DEFINER, no anon access.
--    Keep EXECUTE for `authenticated` so legitimate participants can
--    still go through the RPC; revoke the broad PUBLIC grant that
--    Postgres applies by default.
-- ──────────────────────────────────────────────────────────────────

revoke execute on function public.record_move(
  bigint, integer, text, text, text, text, text, text,
  boolean, boolean, boolean, boolean, boolean,
  text, text, text, integer
) from public;
revoke execute on function public.record_move(
  bigint, integer, text, text, text, text, text, text,
  boolean, boolean, boolean, boolean, boolean,
  text, text, text, integer
) from anon;
grant execute on function public.record_move(
  bigint, integer, text, text, text, text, text, text,
  boolean, boolean, boolean, boolean, boolean,
  text, text, text, integer
) to authenticated;

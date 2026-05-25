-- 0008_bot_game_reliability.sql
-- Adds the bot-game columns used by the application and records Stockfish
-- moves through one locked RPC so move rows and game rows cannot diverge.

alter table public.games
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

create index if not exists idx_games_mode
  on public.games(mode);

alter table public.moves
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
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return json_build_object('success', false, 'error', 'Not authenticated');
  end if;

  perform pg_advisory_xact_lock(p_game_id);

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
    is_promotion
  ) values (
    p_game_id,
    v_current_move_count + 1,
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
    p_is_promotion
  );

  update public.games
  set
    fen = p_fen_after,
    pgn = p_pgn,
    current_player = p_current_player,
    status = p_status,
    winner = p_winner,
    move_count = v_current_move_count + 1,
    last_move_at = timezone('utc', now()),
    updated_at = timezone('utc', now()),
    ended_at = case when p_status <> 'active' then timezone('utc', now()) else ended_at end,
    result_reason = case when p_status <> 'active' then p_status else result_reason end
  where id = p_game_id;

  return json_build_object('success', true);
exception
  when others then
    return json_build_object('success', false, 'error', SQLERRM);
end;
$$;

revoke execute on function public.record_move(
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
  int
) from anon, public;

grant execute on function public.record_move(
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
  int
) to authenticated;

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

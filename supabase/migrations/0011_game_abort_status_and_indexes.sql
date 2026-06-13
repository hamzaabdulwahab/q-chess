-- 0011_game_abort_status_and_indexes.sql
-- Add first-class multiplayer abort support and the indexes needed by
-- realtime game maintenance sweeps.

alter table public.games
  drop constraint if exists games_status_check;

alter table public.games
  add constraint games_status_check
  check (status in ('active','checkmate','stalemate','draw','resigned','timeout','aborted'));

create index if not exists idx_moves_game_id_created_at
  on public.moves(game_id, created_at);

create index if not exists idx_games_owner_status_updated
  on public.games(user_id, status, updated_at desc);

create index if not exists idx_games_white_status_updated
  on public.games(white_user_id, status, updated_at desc)
  where white_user_id is not null;

create index if not exists idx_games_black_status_updated
  on public.games(black_user_id, status, updated_at desc)
  where black_user_id is not null;

create index if not exists idx_games_active_multiplayer_abort
  on public.games(status, move_count, current_player, last_move_at)
  where status = 'active'
    and white_user_id is not null
    and black_user_id is not null
    and move_count <= 1;

create index if not exists idx_games_active_multiplayer_timeout
  on public.games(status, current_player, last_move_at)
  where status = 'active'
    and white_user_id is not null
    and black_user_id is not null
    and time_control_initial_ms is not null
    and white_time_left_ms is not null
    and black_time_left_ms is not null;

export const MULTIPLAYER_FIRST_MOVE_ABORT_MS = 20_000;

// Mid-game abandonment forfeiture: a participant who has sent a presence
// heartbeat and then gone silent for this long (past the opening) forfeits to
// the present opponent. 60s base + a 15s reconnect grace.
export const ABANDON_FORFEIT_MS = 75_000;

import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Realtime contract for a single multiplayer game.
 *
 * We use Supabase Broadcast (not Postgres Changes) as the primary move-sync
 * mechanism for two reasons:
 *
 *   1. Broadcast does NOT require any database publication setup. The
 *      previous postgres_changes-only approach silently failed whenever the
 *      `games` table wasn't in the `supabase_realtime` publication on the
 *      target project — which is exactly how this bug manifested.
 *
 *   2. Broadcast is faster: ~50ms typical end-to-end vs. ~150-400ms for
 *      postgres_changes that has to commit → WAL → poll → fan-out.
 *
 * Postgres Changes is still subscribed to as a secondary fallback so that
 * if a broadcast packet is dropped (or one side reconnects mid-flight),
 * the next DB update will trigger a full reload from the games row.
 *
 * The database remains the source of truth: every move is persisted via
 * the existing /api/games/[id]/moves → record_move RPC path, and refreshes
 * always rehydrate from /api/games/[id].
 */

export const GAME_CHANNEL_PREFIX = "game:";

export function gameChannelName(gameId: number): string {
  return `${GAME_CHANNEL_PREFIX}${gameId}`;
}

export const MOVE_BROADCAST_EVENT = "move";

export interface MoveBroadcastPayload {
  // Game scope — listener must drop messages where this != current gameId.
  gameId: number;
  // 1-based ordinal. Used for dedup against stale/duplicate broadcasts.
  moveNumber: number;
  // Whose move this was.
  player: "white" | "black";
  // Sender's auth uid. Listener with `self: false` shouldn't receive their
  // own messages, but we double-check here as defense-in-depth.
  playerId: string;
  // Move details.
  from: string;
  to: string;
  promotion?: string;
  san: string;
  fenAfter: string;
  // Move flags (so the listener can play the correct sound without
  // re-deriving them from chess.js on the new FEN).
  isCheck: boolean;
  isCheckmate: boolean;
  isCastling: boolean;
  isPromotion: boolean;
  isCapture: boolean;
  // Status after the move — 'active' or one of the chess-rule end states.
  gameStatus: string;
  // ISO timestamp from the sender's clock; informational only (server
  // last_move_at is authoritative).
  createdAt: string;
}

export function isMoveBroadcastPayload(
  value: unknown,
): value is MoveBroadcastPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.gameId === "number" &&
    typeof v.moveNumber === "number" &&
    (v.player === "white" || v.player === "black") &&
    typeof v.playerId === "string" &&
    typeof v.from === "string" &&
    typeof v.to === "string" &&
    typeof v.san === "string" &&
    typeof v.fenAfter === "string"
  );
}

export async function sendMoveBroadcast(
  channel: RealtimeChannel,
  payload: MoveBroadcastPayload,
): Promise<void> {
  await channel.send({
    type: "broadcast",
    event: MOVE_BROADCAST_EVENT,
    payload,
  });
}

"use client";

import { useEffect } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

const HEARTBEAT_INTERVAL_MS = 10_000;

/**
 * Sends a presence heartbeat for an active multiplayer game so the server can
 * tell a connected player from an abandoned one. Renders nothing. The server's
 * abandonment forfeiture only triggers for a player who heartbeat and then went
 * silent (see ABANDON_FORFEIT_MS + the game-maintenance sweep).
 */
export function GameHeartbeat({
  gameId,
  active,
}: {
  gameId: number | null;
  active: boolean;
}) {
  useEffect(() => {
    if (!active || gameId == null) return;
    const supabase = getSupabaseBrowser();

    const beat = () => {
      void supabase
        .rpc("heartbeat_game", { p_game_id: gameId })
        .then(undefined, () => {
          // Heartbeat is best-effort; a dropped beat just shortens the runway
          // before the next one. Never surface an error to the player.
        });
    };

    beat();
    const interval = window.setInterval(beat, HEARTBEAT_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [gameId, active]);

  return null;
}

"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import type { CurrentUserIdentity, OnlineUser } from "./types";

const LOBBY_CHANNEL = "lobby:presence";

type PresenceMeta = OnlineUser & { presence_ref?: string };

export function useLobbyPresence(
  me: CurrentUserIdentity | null,
): OnlineUser[] {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  useEffect(() => {
    if (!me) {
      setOnlineUsers([]);
      return;
    }

    const supabase = getSupabaseBrowser();
    const myPayload: OnlineUser = {
      userId: me.id,
      username: me.username,
      fullName: me.fullName,
      avatarUrl: me.avatarUrl,
      joinedAt: Date.now(),
    };

    const channel = supabase.channel(LOBBY_CHANNEL, {
      config: { presence: { key: me.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceMeta>();
        const users: OnlineUser[] = [];
        for (const key of Object.keys(state)) {
          const presences = state[key];
          const first = presences?.[0];
          if (!first) continue;
          users.push({
            userId: first.userId,
            username: first.username,
            fullName: first.fullName,
            avatarUrl: first.avatarUrl,
            joinedAt: first.joinedAt,
          });
        }
        users.sort((a, b) => a.joinedAt - b.joinedAt);
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track(myPayload);
        }
      });

    return () => {
      void channel.untrack().catch(() => {});
      supabase.removeChannel(channel);
    };
  }, [me]);

  return onlineUsers;
}

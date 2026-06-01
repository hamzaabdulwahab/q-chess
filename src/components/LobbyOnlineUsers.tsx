"use client";

import Image from "next/image";
import { Swords } from "lucide-react";
import { useLobbyPresence } from "@/lib/multiplayer/presence";
import type { CurrentUserIdentity, OnlineUser } from "@/lib/multiplayer/types";

interface LobbyOnlineUsersProps {
  me: CurrentUserIdentity | null;
  onChallenge: (user: OnlineUser) => void;
}

export function LobbyOnlineUsers({ me, onChallenge }: LobbyOnlineUsersProps) {
  const presence = useLobbyPresence(me);
  const others = me ? presence.filter((u) => u.userId !== me.id) : presence;

  return (
    <section className="surface-card">
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{
              background: "oklch(0.72 0.13 145)",
              boxShadow: "0 0 6px oklch(0.72 0.13 145 / 0.6)",
            }}
            aria-hidden="true"
          />
          <h2 className="text-sm font-semibold tracking-tight">Online</h2>
        </div>
        <span className="text-xs text-muted tabular-nums">
          {others.length} {others.length === 1 ? "player" : "players"}
        </span>
      </header>

      {others.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted">
          No other players online right now.
        </div>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {others.map((user) => (
            <li
              key={user.userId}
              className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--surface-1)]"
            >
              <div className="flex min-w-0 items-center gap-3">
                {user.avatarUrl ? (
                  <Image
                    src={user.avatarUrl}
                    alt=""
                    width={32}
                    height={32}
                    unoptimized
                    className="rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="grid h-8 w-8 place-items-center rounded-full text-xs font-semibold"
                    style={{
                      background: "var(--avatar-fallback)",
                      border:
                        "1px solid color-mix(in oklch, var(--avatar-fallback) 78%, white 16%)",
                      color: "white",
                    }}
                  >
                    {user.username.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div
                    className="truncate text-sm font-medium"
                    style={{ color: "var(--text)" }}
                  >
                    @{user.username}
                  </div>
                  {user.fullName && (
                    <div
                      className="truncate text-xs"
                      style={{ color: "var(--text-3)" }}
                    >
                      {user.fullName}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onChallenge(user)}
                className="btn-secondary inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs"
              >
                <Swords className="h-3.5 w-3.5" />
                Challenge
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

"use client";

import { Avatar } from "./Avatar";

export type PlayerBadgeProps = {
  name?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  active?: boolean;
  align?: "top-left" | "bottom-right";
  color?: "white" | "black";
  absolute?: boolean;
};

export function PlayerBadge({
  name,
  username,
  avatarUrl,
  active = false,
  align = "top-left",
  color,
  absolute = true,
}: PlayerBadgeProps) {
  const posClass =
    align === "top-left"
      ? "top-2 left-2"
      : "bottom-2 right-2 flex-row-reverse text-right";
  const borderClass = active ? "border-violet-500 border-2 shadow-violet-500/50" : "border-gray-700";
  const label =
    name || (color ? `${color[0].toUpperCase()}${color.slice(1)}` : "Player");
  const uname = username ? `@${username}` : undefined;

  return (
    <div
      className={`${
        absolute ? `absolute ${posClass} z-20` : ""
      } pointer-events-auto`}
      style={{ maxWidth: 280 }}
    >
      <div
        className={`backdrop-blur bg-black/50 border ${borderClass} rounded-xl px-3 py-2 flex items-center gap-3 shadow-lg`}
      >
        <Avatar name={label} url={avatarUrl || undefined} size={36} />
        <div className="min-w-0">
          <div className="text-sm text-white truncate leading-5">{label}</div>
          <div className="text-xs text-accent truncate">{uname}</div>
        </div>
      </div>
    </div>
  );
}

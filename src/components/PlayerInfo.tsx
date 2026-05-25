"use client";

import Image from "next/image";
import { Clock } from "./Clock";
import { CapturedPieces } from "./CapturedPieces";

export interface PlayerInfoProps {
  username: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
  color: "white" | "black";
  isYou: boolean;
  isCurrentTurn: boolean;
  // Pieces this player has captured (opponent-color piece types).
  capturedPieces: string[];
  // Material advantage of this player. Pass a positive number to show "+N".
  materialAdvantage: number | null;
  // Optional clock data. Pass null timeLeftMs to render an untimed row.
  timeLeftMs: number | null | undefined;
  lastSyncAt: string | null | undefined;
  isClockFrozen?: boolean;
  // Connection state badge (Phase: disconnect handling). For now this is
  // always undefined; reserved so we can light up an amber dot when the
  // opponent's Supabase Presence drops off the game channel.
  connectionState?: "online" | "offline" | undefined;
}

function ColorChip({ color }: { color: "white" | "black" }) {
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full border border-gray-500"
      style={{ backgroundColor: color === "white" ? "#f5f5f5" : "#111" }}
      aria-label={color}
    />
  );
}

export function PlayerInfo({
  username,
  fullName,
  avatarUrl,
  color,
  isYou,
  isCurrentTurn,
  capturedPieces,
  materialAdvantage,
  timeLeftMs,
  lastSyncAt,
  isClockFrozen,
  connectionState,
}: PlayerInfoProps) {
  const label = username ?? (color === "white" ? "White" : "Black");

  const wrapperBorder = isCurrentTurn
    ? "border-white/60 bg-white/[0.06]"
    : "border-gray-700 bg-gray-900/40";

  return (
    <div
      className={[
        "w-full rounded-lg border transition-colors",
        // Mobile: compact horizontal row. md+: vertical card.
        "px-3 py-2 md:px-3 md:py-4",
        "flex flex-row items-center gap-3 md:flex-col md:items-stretch md:gap-3",
        wrapperBorder,
      ].join(" ")}
    >
      {/* Avatar */}
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt=""
          width={36}
          height={36}
          unoptimized
          className="rounded-full object-cover shrink-0 md:self-center md:w-14 md:h-14"
        />
      ) : (
        <div className="w-9 h-9 md:w-14 md:h-14 rounded-full bg-gray-800 grid place-items-center text-sm md:text-xl font-bold text-gray-100 shrink-0 md:self-center">
          {label.slice(0, 1).toUpperCase()}
        </div>
      )}

      {/* Identity + captures */}
      <div className="min-w-0 flex-1 md:flex-none md:text-center">
        <div className="flex items-center gap-1.5 md:justify-center text-sm font-semibold text-white">
          <ColorChip color={color} />
          <span className="truncate max-w-[14ch] md:max-w-[18ch]">
            {username ? `@${username}` : label}
          </span>
        </div>
        {isYou && (
          <div className="text-[10px] uppercase tracking-wider text-gray-300 md:mt-0.5">
            you
          </div>
        )}
        {fullName && (
          <div className="text-xs text-gray-400 truncate md:hidden">
            {fullName}
          </div>
        )}
        {connectionState === "offline" && (
          <div className="mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-amber-300 bg-amber-900/30 border border-amber-700/40 rounded px-1.5 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
            offline
          </div>
        )}
        <div className="md:mt-3 md:flex md:justify-center">
          <CapturedPieces
            pieces={capturedPieces}
            capturedFromColor={color === "white" ? "black" : "white"}
            advantage={materialAdvantage}
          />
        </div>
      </div>

      {/* Clock */}
      <div className="md:mt-1 md:self-stretch md:flex md:justify-center">
        <Clock
          timeLeftMs={timeLeftMs}
          lastSyncAt={lastSyncAt}
          isActive={isCurrentTurn}
          isFrozen={isClockFrozen}
        />
      </div>
    </div>
  );
}

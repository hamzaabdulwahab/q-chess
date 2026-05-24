"use client";

import { useState } from "react";
import { Handshake } from "lucide-react";

interface DrawOfferBannerProps {
  gameId: number;
  offererUsername: string | null;
  onError: (message: string) => void;
}

export function DrawOfferBanner({
  gameId,
  offererUsername,
  onError,
}: DrawOfferBannerProps) {
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);

  const respond = async (action: "accept" | "decline") => {
    try {
      setBusy(action);
      const res = await fetch(`/api/games/${gameId}/draw`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        onError(data.error || `Failed to ${action} draw`);
      }
    } catch {
      onError("Network error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-md px-4 py-3"
      style={{
        background: "var(--accent-soft)",
        border: "1px solid color-mix(in oklch, var(--accent) 30%, transparent)",
      }}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <Handshake
          className="h-4 w-4 shrink-0"
          style={{ color: "var(--accent)" }}
        />
        <span className="truncate text-sm" style={{ color: "var(--text)" }}>
          {offererUsername ? (
            <>
              <span className="font-semibold">@{offererUsername}</span> offers a
              draw
            </>
          ) : (
            "Your opponent offers a draw"
          )}
        </span>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <button
          type="button"
          onClick={() => respond("decline")}
          disabled={busy !== null}
          className="btn-secondary rounded-md px-2.5 py-1 text-xs"
        >
          {busy === "decline" ? "Declining…" : "Decline"}
        </button>
        <button
          type="button"
          onClick={() => respond("accept")}
          disabled={busy !== null}
          className="btn-accent rounded-md px-3 py-1 text-xs"
        >
          {busy === "accept" ? "Accepting…" : "Accept"}
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Flag, Handshake } from "lucide-react";
import { ConfirmDialog } from "./ConfirmDialog";

interface InGameToolbarProps {
  gameId: number;
  canResign: boolean;
  canOfferDraw: boolean;
  drawOfferPendingByMe: boolean;
  onError: (message: string) => void;
}

// Vertical stack sized to fit inside the GameNavigator drawer.
export function InGameToolbar({
  gameId,
  canResign,
  canOfferDraw,
  drawOfferPendingByMe,
  onError,
}: InGameToolbarProps) {
  const [confirmResign, setConfirmResign] = useState(false);
  const [busy, setBusy] = useState<"resign" | "offer-draw" | "cancel-draw" | null>(
    null,
  );

  const resign = async () => {
    setConfirmResign(false);
    try {
      setBusy("resign");
      const res = await fetch(`/api/games/${gameId}/resign`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        onError(data.error || "Failed to resign");
      }
    } catch {
      onError("Failed to resign");
    } finally {
      setBusy(null);
    }
  };

  const offerOrCancelDraw = async () => {
    try {
      if (drawOfferPendingByMe) {
        setBusy("cancel-draw");
        const res = await fetch(`/api/games/${gameId}/draw`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "cancel" }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          onError(data.error || "Failed to cancel draw");
        }
      } else {
        setBusy("offer-draw");
        const res = await fetch(`/api/games/${gameId}/draw`, {
          method: "POST",
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          onError(data.error || "Failed to offer draw");
        }
      }
    } catch {
      onError("Network error");
    } finally {
      setBusy(null);
    }
  };

  const drawLabel = drawOfferPendingByMe
    ? busy === "cancel-draw"
      ? "Cancelling…"
      : "Cancel draw offer"
    : busy === "offer-draw"
      ? "Offering…"
      : "Offer draw";

  return (
    <>
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={offerOrCancelDraw}
          disabled={!canOfferDraw || busy !== null}
          className="btn-secondary inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm"
          style={
            drawOfferPendingByMe
              ? {
                  background: "var(--accent-soft)",
                  borderColor: "var(--accent)",
                  color: "var(--accent)",
                }
              : undefined
          }
        >
          <Handshake className="h-4 w-4" />
          {drawLabel}
        </button>
        <button
          type="button"
          onClick={() => setConfirmResign(true)}
          disabled={!canResign || busy !== null}
          className="btn-danger inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm"
        >
          <Flag className="h-4 w-4" />
          {busy === "resign" ? "Resigning…" : "Resign"}
        </button>
      </div>

      <ConfirmDialog
        isOpen={confirmResign}
        title="Resign the game?"
        message="Your opponent will be declared the winner. This can't be undone."
        confirmText="Resign"
        cancelText="Keep playing"
        onConfirm={resign}
        onCancel={() => setConfirmResign(false)}
      />
    </>
  );
}

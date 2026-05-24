"use client";

import { useEffect, useState } from "react";
import { Shuffle, X } from "lucide-react";
import type { BotColorChoice } from "@/lib/stockfish/types";

interface BotGameModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (gameId: number) => void;
}

export function BotGameModal({ open, onClose, onCreated }: BotGameModalProps) {
  const [color, setColor] = useState<BotColorChoice>("white");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSubmitting(false);
      setError(null);
      return;
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const create = async () => {
    try {
      setSubmitting(true);
      setError(null);
      // The server defaults the level to "monster" when not provided.
      const res = await fetch("/api/games/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        gameId?: number;
        error?: string;
      };
      if (!res.ok || !data.gameId) {
        setError(data.error || "Failed to start game");
        return;
      }
      onCreated(data.gameId);
    } catch {
      setError("Failed to start game");
    } finally {
      setSubmitting(false);
    }
  };

  const colorOptions: Array<{
    id: BotColorChoice;
    label: string;
    swatch: string;
  }> = [
    { id: "white", label: "White", swatch: "var(--text)" },
    { id: "black", label: "Black", swatch: "var(--bg)" },
    { id: "random", label: "Random", swatch: "transparent" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "oklch(0 0 0 / 0.55)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bot-game-title"
    >
      <div
        className="surface-card w-full max-w-sm"
        style={{ boxShadow: "var(--shadow-lg)" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <h2
            id="bot-game-title"
            className="text-base font-semibold tracking-tight"
          >
            Play vs Stockfish
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost rounded-md p-1.5"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="px-5 py-5 space-y-4">
          <div>
            <div
              className="mb-2 text-xs font-medium uppercase tracking-wider"
              style={{ color: "var(--text-3)" }}
            >
              Play as
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {colorOptions.map((opt) => {
                const isActive = color === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setColor(opt.id)}
                    className="flex items-center justify-center gap-2 rounded-md py-2.5 text-sm font-medium transition-colors"
                    style={{
                      background: isActive
                        ? "var(--accent-soft)"
                        : "var(--surface-1)",
                      color: isActive ? "var(--text)" : "var(--text-2)",
                      border: `1px solid ${
                        isActive ? "var(--text)" : "var(--border-strong)"
                      }`,
                    }}
                  >
                    {opt.id === "random" ? (
                      <Shuffle className="h-3.5 w-3.5" />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="inline-block h-3 w-3 rounded-full"
                        style={{
                          background: opt.swatch,
                          border: "1px solid var(--border-strong)",
                        }}
                      />
                    )}
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div
              className="rounded-md px-3 py-2 text-sm"
              style={{
                background: "var(--danger-soft)",
                color: "var(--text)",
                border:
                  "1px solid color-mix(in oklch, var(--danger) 40%, transparent)",
              }}
              role="alert"
            >
              {error}
            </div>
          )}
        </div>

        <footer
          className="flex justify-end gap-2 px-5 py-4"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="btn-secondary rounded-md px-3 py-1.5 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={create}
            disabled={submitting}
            className="btn-accent rounded-md px-4 py-1.5 text-sm"
          >
            {submitting ? "Starting…" : "Start game"}
          </button>
        </footer>
      </div>
    </div>
  );
}

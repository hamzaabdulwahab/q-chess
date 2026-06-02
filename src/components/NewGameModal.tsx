"use client";

import { useEffect, useRef } from "react";
import { Bot, Inbox, UserPlus, Users, X, type LucideIcon } from "lucide-react";
import { AppIcon } from "@/components/AppIcon";

export type NewGameChoice =
  | "local-2v2"
  | "invite-user"
  | "invites-inbox"
  | "play-vs-bot"
  | null;

interface Option {
  id: Exclude<NewGameChoice, null>;
  label: string;
  description: string;
  Icon: LucideIcon;
  primary?: boolean;
}

const OPTIONS: Option[] = [
  {
    id: "play-vs-bot",
    label: "Play vs Stockfish",
    description: "Choose White, Black, or Random. Strength is automatic.",
    Icon: Bot,
    primary: true,
  },
  {
    id: "invite-user",
    label: "Challenge a player",
    description: "Send an invitation by username.",
    Icon: UserPlus,
  },
  {
    id: "invites-inbox",
    label: "Open invitations",
    description: "See incoming, outgoing, and accepted challenges.",
    Icon: Inbox,
  },
  {
    id: "local-2v2",
    label: "Local hot-seat",
    description: "Two players on the same device.",
    Icon: Users,
  },
];

export function NewGameModal({
  open,
  onClose,
  onChoose,
}: {
  open: boolean;
  onClose: () => void;
  onChoose: (choice: NewGameChoice) => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const choose = (choice: NewGameChoice) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("qchess:new-game-choice", {
          detail: { choice },
        }),
      );
    }
    onChoose(choice);
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "oklch(0 0 0 / 0.55)" }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-game-title"
    >
      <div
        ref={dialogRef}
        onMouseDown={(event) => event.stopPropagation()}
        className="surface-card w-full max-w-md"
        style={{ boxShadow: "var(--shadow-lg)" }}
      >
        <header
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <h2
            id="new-game-title"
            className="text-base font-semibold tracking-tight"
          >
            Start a game
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost rounded-md p-1.5"
            aria-label="Close"
          >
            <AppIcon icon={X} className="h-4 w-4" />
          </button>
        </header>

        <div className="p-3">
          <ul className="space-y-1.5">
            {OPTIONS.map((opt) => {
              const { Icon } = opt;
              return (
                <li key={opt.id}>
                  <button
                    type="button"
                    onClick={() => choose(opt.id)}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-1)]"
                    style={{
                      border: opt.primary
                        ? "1px solid var(--border-strong)"
                        : "1px solid transparent",
                    }}
                  >
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-md"
                      style={{
                        background: "var(--surface-1)",
                        border: "1px solid var(--border-strong)",
                        color: "var(--text)",
                      }}
                    >
                      <AppIcon icon={Icon} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className="block truncate text-sm font-medium"
                        style={{ color: "var(--text)" }}
                      >
                        {opt.label}
                      </span>
                      <span
                        className="block truncate text-xs"
                        style={{ color: "var(--text-3)" }}
                      >
                        {opt.description}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

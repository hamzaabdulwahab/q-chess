"use client";

import { useEffect, useRef } from "react";

export type NewGameChoice =
  | "local-2v2"
  | "invite-user"
  | "invites-inbox"
  | null;

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
        })
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
      className="fixed inset-0 z-50 grid place-items-center bg-black/60"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        onMouseDown={(event) => event.stopPropagation()}
        className="w-[90%] max-w-md rounded-xl border border-violet-700 bg-gray-900 text-white shadow-2xl p-6"
      >
        <div className="text-lg font-semibold mb-2">Start new game</div>
        <div className="text-sm text-accent mb-6">
          Choose how you&apos;d like to play
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
              choose("local-2v2");
            }}
            onClick={() => choose("local-2v2")}
            className="w-full btn-accent text-black px-4 py-3 rounded-lg transition-colors font-medium"
          >
            Human vs Human
          </button>
          <button
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
              choose("invite-user");
            }}
            onClick={() => choose("invite-user")}
            className="w-full bg-violet-700 hover:bg-violet-600 text-white px-4 py-3 rounded-lg transition-colors font-medium"
          >
            Play by Username
          </button>
          <button
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
              choose("invites-inbox");
            }}
            onClick={() => choose("invites-inbox")}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white px-4 py-3 rounded-lg transition-colors font-medium"
          >
            Invites Inbox
          </button>
          {/* Vs Computer option removed */}
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

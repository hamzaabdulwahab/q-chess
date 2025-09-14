"use client";

import { useEffect, useRef } from "react";

export type NewGameChoice = "local-2v2" | "online" | "invite" | null;

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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (dialogRef.current && dialogRef.current.contains(t)) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60">
      <div
        ref={dialogRef}
        className="w-[90%] max-w-md rounded-xl border border-violet-700 bg-gray-900 text-white shadow-2xl p-6"
      >
        <div className="text-lg font-semibold mb-2">Start new game</div>
        <div className="text-sm text-accent mb-6">
          Choose how you&apos;d like to play
        </div>

        <div className="space-y-3">
          <button
            onClick={() => onChoose("local-2v2")}
            className="w-full btn-accent text-black px-4 py-3 rounded-lg transition-colors font-medium"
          >
            2 vs 2 on this machine
          </button>
          <button
            onClick={() => onChoose("online")}
            className="w-full bg-gray-800 hover:bg-gray-700 text-white px-4 py-3 rounded-lg transition-colors font-medium"
          >
            Play online with someone
          </button>
          <button
            onClick={() => onChoose("invite")}
            className="w-full bg-gray-800 hover:bg-gray-700 text-white px-4 py-3 rounded-lg transition-colors font-medium"
          >
            Invite by username
          </button>
          <button
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

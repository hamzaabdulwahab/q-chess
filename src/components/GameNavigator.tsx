"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NewGameModal, type NewGameChoice } from "./NewGameModal";
// Invite-related modals are not used here anymore
import { SoundControl } from "@/components/SoundControl";
import { ThemeSelector } from "@/components/ThemeSelector";

type Props = {
  onNewGame: (choice: NewGameChoice) => void;
};

export function GameNavigator({ onNewGame }: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [newGameOpen, setNewGameOpen] = useState(false);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (ev: MouseEvent | TouchEvent) => {
      const target = ev.target as Node | null;
      if (panelRef.current && target && panelRef.current.contains(target))
        return;
      setOpen(false);
    };
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const guardedNav = (e: React.MouseEvent, href: string) => {
    setOpen(false);
    if ((window as unknown as Record<string, unknown>).__PROFILE_DIRTY__) {
      e.preventDefault();
      window.dispatchEvent(
        new CustomEvent("profile-guard", { detail: { href } }),
      );
    }
  };

  return (
    <>
      {/* Toggle handle (hamburger) at top-left to mirror user menu; hidden when panel is open */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed top-4 left-4 z-50 w-10 h-10 rounded-full border border-gray-700 bg-gray-800/90 text-white grid place-items-center shadow hover:bg-gray-700"
          aria-expanded={open}
          aria-controls="game-navigator"
          aria-label="Open navigator"
          title="Navigator"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* Slide-out panel */}
      <div
        id="game-navigator"
        ref={panelRef}
        className={`fixed top-0 left-0 z-40 h-screen w-64 transform transition-transform duration-200 ease-out bg-gray-900 border-r border-gray-700 shadow-xl ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 pb-2 text-white flex items-center justify-between">
          <div className="text-sm uppercase tracking-wide text-gray-400">
            Main Menu
          </div>
          <button
            onClick={() => setOpen(false)}
            className="w-8 h-8 grid place-items-center rounded-md hover:bg-gray-800"
            aria-label="Close navigator"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-4 pb-4 text-white">
          <div className="space-y-3 mt-2">
            <button
              onClick={() => {
                setOpen(false);
                setNewGameOpen(true);
              }}
              className="w-full btn-accent text-black px-4 py-2 rounded-lg transition-colors font-medium"
            >
              New Game
            </button>
            {/* Invites entry moved into New Game modal */}
            <Link
              href="/"
              onClick={(e) => guardedNav(e, "/")}
              className="block w-full text-center bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
            >
              Home
            </Link>
            <Link
              href="/archive"
              onClick={(e) => guardedNav(e, "/archive")}
              className="block w-full text-center bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
              title="Game Archive"
            >
              Archive
            </Link>

            {/* Memes and YouTube toggles removed by request */}

            {/* Theme selector */}
            <div className="block w-full pt-2 border-t border-gray-800">
              <ThemeSelector />
            </div>

            {/* Sound toggle inline */}
            <div className="block w-full pt-2 border-t border-gray-800">
              <SoundControl
                variant="compact"
                className="w-full justify-center"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Subtle overlay when open (click closes) */}
      {open && (
        <button
          aria-label="Close navigator"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/20"
        />
      )}

      {/* New Game modal */}
      <NewGameModal
        open={newGameOpen}
        onClose={() => setNewGameOpen(false)}
        onChoose={(choice) => {
          setNewGameOpen(false);
          if (!choice) return;
          onNewGame(choice);
        }}
      />

      {/* Invite modals removed; bell dropdown handles invites */}
    </>
  );
}

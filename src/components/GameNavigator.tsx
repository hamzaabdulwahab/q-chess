"use client";

import Link from "next/link";
import { Archive, CirclePlay, Inbox, Menu, Send, X } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { type NewGameChoice } from "./NewGameModal";
import { InviteUserModal } from "@/components/InviteUserModal";
import { InvitesInboxModal } from "@/components/InvitesInboxModal";
import { SoundControl } from "@/components/SoundControl";
import { ThemeSelector } from "@/components/ThemeSelector";
import { InGameToolbar } from "@/components/InGameToolbar";

export type GameActions = {
  gameId: number;
  isActive: boolean;
  drawOfferFromMe: boolean;
  drawOfferFromOpponent: boolean;
  onError: (message: string) => void;
};

type Props = {
  onNewGame: (choice: NewGameChoice) => void;
  onStartRemoteGame?: (gameId: number) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showButton?: boolean;
  gameActions?: GameActions;
};

export function GameNavigator({
  onNewGame,
  onStartRemoteGame,
  open: externalOpen,
  onOpenChange,
  showButton = true,
  gameActions,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [inviteComposerOpen, setInviteComposerOpen] = useState(false);
  const [invitesInboxOpen, setInvitesInboxOpen] = useState(false);
  
  // Use external open state if provided, otherwise use internal state
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  
  // State for tooltip visibility - should only be true when hovering navigator button
  const [showTooltip, setShowTooltip] = useState(false);

  // Debug: Reset tooltip when navigator opens or button is hidden
  useEffect(() => {
    if (open || !showButton) {
      setShowTooltip(false);
    }
  }, [open, showButton]);
  
  // Memoized toggle function to prevent useEffect dependency issues
  const toggleNavigator = useCallback(() => {
    if (onOpenChange) {
      onOpenChange(!open);
    } else {
      setInternalOpen(prev => !prev);
    }
  }, [open, onOpenChange]);

  // Global keyboard shortcut listener (only in uncontrolled mode)
  useEffect(() => {
    if (externalOpen !== undefined) return;

    const handleGlobalKeydown = (ev: KeyboardEvent) => {
      // Handle Cmd+B (Mac) or Ctrl+B (Windows/Linux) to toggle navigator
      if (ev.key === "b" && (ev.metaKey || ev.ctrlKey)) {
        ev.preventDefault();
        toggleNavigator();
        return;
      }
    };

    // Add global listener
    document.addEventListener("keydown", handleGlobalKeydown);
    
    return () => {
      document.removeEventListener("keydown", handleGlobalKeydown);
    };
  }, [externalOpen, toggleNavigator]); // Now properly depends on the memoized function

  // Close on outside click or Escape (when navigator is open)
  useEffect(() => {
    if (!open) return;

    const onDown = (ev: MouseEvent | TouchEvent) => {
      const target = ev.target as Node | null;
      if (panelRef.current && target && panelRef.current.contains(target))
        return;
      if (onOpenChange) {
        onOpenChange(false);
      } else {
        setInternalOpen(false);
      }
    };
    
    const onKey = (ev: KeyboardEvent) => {
      // Handle Escape to close when navigator is open
      if (ev.key === "Escape") {
        if (onOpenChange) {
          onOpenChange(false);
        } else {
          setInternalOpen(false);
        }
        return;
      }
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    document.addEventListener("keydown", onKey);
    
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  const guardedNav = (e: React.MouseEvent, href: string) => {
    if (onOpenChange) {
      onOpenChange(false);
    } else {
      setInternalOpen(false);
    }
    if ((window as unknown as Record<string, unknown>).__PROFILE_DIRTY__) {
      e.preventDefault();
      window.dispatchEvent(
        new CustomEvent("profile-guard", { detail: { href } }),
      );
    }
  };

  return (
    <>
      {/* Toggle handle (hamburger) — top-left, hidden when panel is open. */}
      {!open && showButton && (
        <div className="relative">
          <button
            onClick={() => {
              if (onOpenChange) onOpenChange(true);
              else setInternalOpen(true);
            }}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            className="fixed top-4 left-4 z-50 grid h-10 w-10 place-items-center rounded-md transition-colors md:left-24 lg:left-60"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-strong)",
              color: "var(--text)",
              boxShadow: "var(--shadow)",
            }}
            aria-expanded={open}
            aria-controls="game-navigator"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {showTooltip && (
            <div
              className="pointer-events-none fixed left-4 z-[60] rounded-md px-2.5 py-1.5 text-xs font-medium md:left-24 lg:left-60"
              style={{
                top: "3.75rem",
                background: "var(--surface-2)",
                color: "var(--text)",
                border: "1px solid var(--border-strong)",
                boxShadow: "var(--shadow)",
              }}
            >
              Menu · {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+B
            </div>
          )}
        </div>
      )}

      {/* Slide-out panel */}
      <div
        id="game-navigator"
        ref={panelRef}
        className={`fixed top-0 left-0 z-40 h-screen w-72 transform transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
          boxShadow: open ? "var(--shadow-lg)" : "none",
        }}
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <span className="text-sm font-semibold tracking-tight">Menu</span>
          <button
            type="button"
            onClick={() => {
              if (onOpenChange) onOpenChange(false);
              else setInternalOpen(false);
            }}
            className="btn-ghost rounded-md p-1.5"
            aria-label="Close menu"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="px-5 py-4">
          {gameActions?.isActive && (
            <section className="mb-5">
              <div
                className="mb-2 text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-3)" }}
              >
                Current game
              </div>
              <InGameToolbar
                gameId={gameActions.gameId}
                canResign={true}
                canOfferDraw={!gameActions.drawOfferFromOpponent}
                drawOfferPendingByMe={gameActions.drawOfferFromMe}
                onError={gameActions.onError}
              />
            </section>
          )}

          <section>
            <div
              className="mb-2 text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-3)" }}
            >
              Play
            </div>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  if (onOpenChange) onOpenChange(false);
                  else setInternalOpen(false);
                  onNewGame("local-2v2");
                }}
                className="btn-accent inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm"
              >
                <CirclePlay className="h-4 w-4" aria-hidden="true" />
                New local game
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onOpenChange) onOpenChange(false);
                  else setInternalOpen(false);
                  setInviteComposerOpen(true);
                }}
                className="btn-secondary inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                Challenge by username
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onOpenChange) onOpenChange(false);
                  else setInternalOpen(false);
                  setInvitesInboxOpen(true);
                }}
                className="btn-secondary inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm"
              >
                <Inbox className="h-4 w-4" aria-hidden="true" />
                Open invitations
              </button>
            </div>
          </section>

          <section className="mt-5">
            <div
              className="mb-2 text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-3)" }}
            >
              Navigate
            </div>
            <div className="space-y-1.5">
              <Link
                href="/"
                onClick={(e) => guardedNav(e, "/")}
                className="btn-ghost block w-full rounded-md px-3 py-2 text-center text-sm"
              >
                Lobby
              </Link>
              <Link
                href="/archive"
                onClick={(e) => guardedNav(e, "/archive")}
                className="btn-ghost inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-center text-sm"
              >
                <Archive className="h-4 w-4" aria-hidden="true" />
                Archive
              </Link>
            </div>
          </section>

          <section
            className="mt-5 pt-4"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <div className="space-y-3">
              <ThemeSelector />
              <SoundControl
                variant="compact"
                className="w-full justify-center"
              />
            </div>
          </section>
        </div>
      </div>

      {/* Subtle overlay when open (click closes) */}
      {open && (
        <button
          aria-label="Close navigator"
          onClick={() => {
            if (onOpenChange) {
              onOpenChange(false);
            } else {
              setInternalOpen(false);
            }
          }}
          className="fixed inset-0 z-30 bg-black/20"
        />
      )}

      <InviteUserModal
        open={inviteComposerOpen}
        onClose={() => setInviteComposerOpen(false)}
      />

      <InvitesInboxModal
        open={invitesInboxOpen}
        onClose={() => setInvitesInboxOpen(false)}
        onStartGame={(acceptedGameId) => {
          setInvitesInboxOpen(false);
          onStartRemoteGame?.(acceptedGameId);
        }}
      />

    </>
  );
}

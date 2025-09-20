"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { NewGameModal, type NewGameChoice } from "./NewGameModal";
// Invite-related modals are not used here anymore
import { SoundControl } from "@/components/SoundControl";
import { ThemeSelector } from "@/components/ThemeSelector";

type Props = {
  onNewGame: (choice: NewGameChoice) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showButton?: boolean;
};

export function GameNavigator({ onNewGame, open: externalOpen, onOpenChange, showButton = true }: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [newGameOpen, setNewGameOpen] = useState(false);
  
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

  // Global keyboard shortcut listener - works regardless of component visibility
  useEffect(() => {
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
  }, [toggleNavigator]); // Now properly depends on the memoized function

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
      {/* Toggle handle (hamburger) at top-left to mirror user menu; hidden when panel is open */}
      {!open && showButton && (
        <div className="relative">
          <button
            onClick={() => {
              if (onOpenChange) {
                onOpenChange(true);
              } else {
                setInternalOpen(true);
              }
            }}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            className="fixed top-4 left-4 z-50 w-10 h-10 rounded-full border border-gray-700 text-white grid place-items-center shadow hover:bg-gray-700"
            style={{ backgroundColor: '#0F0C08' }}
            aria-expanded={open}
            aria-controls="game-navigator"
            aria-label="Open navigator"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          {/* Custom Tooltip */}
          {showTooltip && (
            <div 
              className="fixed z-[60] px-3 py-2 text-white text-sm font-medium rounded-lg shadow-lg pointer-events-none"
              style={{ 
                backgroundColor: '#1a1a1a',
                top: '4rem',
                left: '1rem',
                fontSize: '14px',
                fontFamily: "'Inter', sans-serif"
              }}
            >
              Navigator ({navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+B)
              <div 
                className="absolute w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent"
                style={{ 
                  borderBottomColor: '#1a1a1a',
                  top: '-4px',
                  left: '12px'
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Slide-out panel */}
      <div
        id="game-navigator"
        ref={panelRef}
        className={`fixed top-0 left-0 z-40 h-screen w-64 transform transition-transform duration-200 ease-out border-r border-gray-700 shadow-xl ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ backgroundColor: '#0F0C08' }}
      >
        <div className="p-4 pb-2 text-white flex items-center justify-between">
          <div 
            className="uppercase tracking-wide text-gray-400"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 700,
              fontSize: '18px'
            }}
          >
            Controls
          </div>
          <button
            onClick={() => {
              if (onOpenChange) {
                onOpenChange(false);
              } else {
                setInternalOpen(false);
              }
            }}
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
                if (onOpenChange) {
                  onOpenChange(false);
                } else {
                  setInternalOpen(false);
                }
                setNewGameOpen(true);
              }}
              className="w-full btn-accent text-black rounded-lg transition-colors"
              style={{ 
                fontFamily: "'Inter', sans-serif",
                fontWeight: 500,
                fontSize: '16px',
                padding: '0.6em 1.2em',
                borderRadius: '8px'
              }}
            >
              New Game
            </button>
            {/* Invites entry moved into New Game modal */}
            <Link
              href="/"
              onClick={(e) => guardedNav(e, "/")}
              className="block w-full text-center text-white transition-colors hover:opacity-80"
              style={{ 
                backgroundColor: '#1B1B1B',
                fontFamily: "'Inter', sans-serif",
                fontWeight: 500,
                fontSize: '16px',
                padding: '0.6em 1.2em',
                borderRadius: '8px'
              }}
            >
              Home
            </Link>
            <Link
              href="/archive"
              onClick={(e) => guardedNav(e, "/archive")}
              className="block w-full text-center text-white transition-colors hover:opacity-80"
              style={{ 
                backgroundColor: '#1B1B1B',
                fontFamily: "'Inter', sans-serif",
                fontWeight: 500,
                fontSize: '16px',
                padding: '0.6em 1.2em',
                borderRadius: '8px'
              }}
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

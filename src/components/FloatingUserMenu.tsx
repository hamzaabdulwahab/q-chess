"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { useEffect, useRef, useState } from "react";
import { Home, User, LogOut } from "lucide-react";
// InvitesBell removed

export function FloatingUserMenu() {
  const pathname = usePathname() ?? "";
  const isHome = pathname === "/";
  const isProfile = pathname.startsWith("/profile");
  const isBoard = pathname.startsWith("/board");
  const [open, setOpen] = useState(false);
  const SOURCE = "user-menu";
  const rootRef = useRef<HTMLDivElement | null>(null);
  // no inbox modal here; the bell renders a dropdown list

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(false);
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
    window.location.href = "/auth/signin";
  };

  const guardedNav = (e: React.MouseEvent, href: string) => {
    setOpen(false);
    if ((window as unknown as Record<string, unknown>).__PROFILE_DIRTY__) {
      e.preventDefault();
      window.dispatchEvent(
        new CustomEvent("profile-guard", { detail: { href } }),
      );
    }
  };

  // Close menu on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (ev: MouseEvent | TouchEvent) => {
      const el = rootRef.current;
      if (!el) return;
      const target = ev.target as Node | null;
      if (target && el.contains(target)) return;
      setOpen(false);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Close if another dropdown announces it opened
  useEffect(() => {
    const onOtherOpen = (ev: Event) => {
      const detail = (ev as CustomEvent<{ source?: string }>).detail;
      if (detail?.source !== SOURCE) setOpen(false);
    };
    window.addEventListener(
      "dropdown:open" as unknown as keyof WindowEventMap,
      onOtherOpen as EventListener,
    );
    return () => {
      window.removeEventListener(
        "dropdown:open" as unknown as keyof WindowEventMap,
        onOtherOpen as EventListener,
      );
    };
  }, []);

  // Hide entirely on auth routes and the game board page
  if (pathname.startsWith("/auth") || isBoard) return null;

  return (
    <div
      ref={rootRef}
      className="fixed top-6 right-6 z-50 flex items-center gap-2"
    >
      <div className="relative">
        <button
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() =>
            setOpen((v) => {
              const next = !v;
              if (next) {
                window.dispatchEvent(
                  new CustomEvent("dropdown:open", {
                    detail: { source: SOURCE },
                  }),
                );
              }
              return next;
            })
          }
          className={`w-10 h-10 rounded-lg bg-gray-800/90 border border-gray-700 text-white grid place-items-center shadow transition-all duration-200 ${
            open
              ? "bg-violet-700 border-violet-600 scale-105"
              : "hover:bg-gray-700 hover:border-gray-600"
          }`}
          title="Menu"
        >
          <User
            className={`w-5 h-5 transition-transform duration-200 ${
              open ? "scale-110" : ""
            }`}
            aria-hidden
          />
          {/* Dropdown Arrow (points to menu) */}
          <svg
            className={`absolute -bottom-1 right-2 w-3 h-3 text-gray-800 transition-all duration-200 ${
              open ? "opacity-100 scale-100" : "opacity-0 scale-75"
            }`}
            fill="currentColor"
            viewBox="0 0 12 6"
          >
            <path d="M6 6L0 0h12z" />
          </svg>
        </button>
        <div
          className={`absolute mt-3 w-56 rounded-lg border border-gray-700 bg-gray-900/95 backdrop-blur-sm text-gray-200 shadow-xl transition-all duration-200 right-0 origin-top-right dropdown-typography ${
            open
              ? "opacity-100 scale-100 translate-y-0"
              : "opacity-0 scale-95 translate-y-[-10px] pointer-events-none"
          }`}
          style={{ maxHeight: "calc(100vh - 120px)", overflowY: "auto" }}
        >
          {/* Dropdown Arrow (menu corner) */}
          <div className="absolute -top-1.5 right-3 w-3 h-3 bg-gray-900 border-l border-t border-gray-700 rotate-45"></div>
          <nav className="py-2">
            <Link
              href="/"
              onClick={(e) => guardedNav(e, "/")}
              className={`block px-4 py-2.5 transition-all duration-200 tracking-[0.1px] ${
                isHome
                  ? "text-accent bg-accent-ghost font-medium"
                  : "hover:bg-gray-800 hover:text-white hover:font-medium font-normal"
              }`}
            >
              <span className="flex items-center gap-2">
                <Home className="w-4 h-4" aria-hidden />
                Q-Chess
              </span>
            </Link>
            <Link
              href="/profile"
              onClick={(e) => guardedNav(e, "/profile")}
              className={`block px-4 py-2.5 transition-all duration-200 tracking-[0.1px] ${
                isProfile
                  ? "text-accent bg-accent-ghost font-medium"
                  : "hover:bg-gray-800 hover:text-white hover:font-medium font-normal"
              }`}
            >
              <span className="flex items-center gap-2">
                <User className="w-4 h-4" aria-hidden />
                View Profile
              </span>
            </Link>
            <div className="border-t border-gray-700 my-1"></div>
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2.5 hover:bg-red-600/20 hover:text-red-400 hover:font-medium transition-all duration-200 tracking-[0.1px] font-normal"
              type="button"
            >
              <span className="flex items-center gap-2">
                <LogOut className="w-4 h-4" aria-hidden />
                Log out
              </span>
            </button>
          </nav>
        </div>
      </div>
      {/* Inbox modal removed; invites shown in bell dropdown */}
    </div>
  );
}

// no default export

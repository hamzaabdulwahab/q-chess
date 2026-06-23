"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAndRedirect } from "@/lib/auth-context";
import { useEffect, useRef, useState } from "react";
import { LogOut, Play, UserRound } from "lucide-react";
import { AppIcon } from "@/components/AppIcon";

export function FloatingUserMenu() {
  const pathname = usePathname() ?? "";
  const isHome = pathname === "/";
  const isProfile = pathname.startsWith("/profile");
  const isBoard = pathname.startsWith("/board");
  const isArchive = pathname.startsWith("/archive");
  const [open, setOpen] = useState(false);
  const SOURCE = "user-menu";
  const rootRef = useRef<HTMLDivElement | null>(null);

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(false);
    await signOutAndRedirect();
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

  // App-shell pages render their own navigation. Hiding this legacy floating
  // trigger prevents the old profile affordance from competing with the rail.
  if (pathname.startsWith("/auth") || isBoard || isHome || isProfile || isArchive) {
    return null;
  }

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
          className={`grid h-10 w-10 place-items-center rounded-md border shadow transition-all duration-200 ${
            open
              ? "scale-105"
              : "hover:bg-[var(--surface-1)]"
          }`}
          style={{
            background: open ? "var(--accent)" : "var(--surface)",
            borderColor: open ? "var(--accent)" : "var(--border-strong)",
            color: open ? "var(--accent-fg)" : "var(--text)",
          }}
          title="Menu"
        >
          <AppIcon
            icon={UserRound}
            className={`w-5 h-5 transition-transform duration-200 ${
              open ? "scale-110" : ""
            }`}
          />
          {/* Dropdown Arrow (points to menu) */}
          <svg
            className={`absolute -bottom-1 right-2 w-3 h-3 transition-all duration-200 ${
              open ? "opacity-100 scale-100" : "opacity-0 scale-75"
            }`}
            style={{ color: open ? "var(--accent)" : "var(--surface)" }}
            fill="currentColor"
            viewBox="0 0 12 6"
          >
            <path d="M6 6L0 0h12z" />
          </svg>
        </button>
        <div
          className={`absolute right-0 mt-3 w-56 origin-top-right rounded-md border text-sm shadow-xl transition-all duration-200 dropdown-typography ${
            open
              ? "opacity-100 scale-100 translate-y-0"
              : "opacity-0 scale-95 translate-y-[-10px] pointer-events-none"
          }`}
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            color: "var(--text-2)",
            maxHeight: "calc(100vh - 120px)",
            overflowY: "auto",
          }}
        >
          {/* Dropdown Arrow (menu corner) */}
          <div
            className="absolute -top-1.5 right-3 h-3 w-3 rotate-45 border-l border-t"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
            }}
          ></div>
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
                <AppIcon icon={Play} className="w-4 h-4" />
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
                <AppIcon icon={UserRound} className="w-4 h-4" />
                View Profile
              </span>
            </Link>
            <div
              className="my-1 border-t"
              style={{ borderColor: "var(--border)" }}
            ></div>
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2.5 hover:bg-red-600/20 hover:text-red-400 hover:font-medium transition-all duration-200 tracking-[0.1px] font-normal"
              type="button"
            >
              <span className="flex items-center gap-2">
                <AppIcon icon={LogOut} className="w-4 h-4" />
                Log out
              </span>
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}

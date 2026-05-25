"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Archive,
  ChevronLeft,
  CirclePlay,
  Crown,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
  X,
} from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type ShellVariant = "page" | "game";

interface ChessLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  variant?: ShellVariant;
  className?: string;
  showHeader?: boolean;
}

const navItems = [
  { href: "/", label: "Play", Icon: CirclePlay },
  { href: "/board", label: "Board", Icon: Crown },
  { href: "/archive", label: "Archive", Icon: Archive },
  { href: "/profile", label: "Profile", Icon: UserRound },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

function BrandMark({
  expanded = true,
  labelAlways = false,
}: {
  expanded?: boolean;
  labelAlways?: boolean;
}) {
  return (
    <Link
      href="/"
      className={`group flex items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] ${
        expanded ? "gap-2" : "justify-center"
      }`}
      aria-label="Q-Chess home"
      title="Q-Chess"
    >
      <span
        className="grid h-9 w-9 place-items-center rounded-md text-base font-bold"
        style={{
          background: "var(--accent)",
          color: "var(--accent-fg)",
        }}
      >
        Q
      </span>
      <span
        className={`text-sm font-semibold tracking-tight ${
          expanded ? (labelAlways ? "inline" : "hidden lg:inline") : "sr-only"
        }`}
      >
        Q-Chess
      </span>
    </Link>
  );
}

export function ChessLayout({
  children,
  title,
  subtitle,
  actions,
  variant = "page",
  className = "",
  showHeader = true,
}: ChessLayoutProps) {
  const pathname = usePathname() ?? "";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [railExpanded, setRailExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      setRailExpanded(
        window.localStorage.getItem("q-chess.railExpanded") === "true",
      );
    } catch {
      // Non-fatal: keep the quiet collapsed rail.
    }
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (target && panelRef.current?.contains(target)) return;
      setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [mobileOpen]);

  const guardedNav = (event: React.MouseEvent, href: string) => {
    if ((window as unknown as Record<string, unknown>).__PROFILE_DIRTY__) {
      event.preventDefault();
      window.dispatchEvent(
        new CustomEvent("profile-guard", { detail: { href } }),
      );
    }
  };

  const logout = async () => {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
    window.location.href = "/auth/signin";
  };

  const toggleRail = () => {
    setRailExpanded((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("q-chess.railExpanded", String(next));
      } catch {
        // Non-fatal.
      }
      return next;
    });
  };

  const renderNav = (expanded: boolean) => (
    <nav className="space-y-1" aria-label="Primary navigation">
      {navItems.map(({ href, label, Icon }) => {
        const active = isActivePath(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={(event) => guardedNav(event, href)}
            className={`group flex items-center rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] ${
              expanded ? "justify-center lg:justify-start lg:gap-3" : "justify-center"
            }`}
            style={{
              background: active ? "var(--accent-soft)" : "transparent",
              color: active ? "var(--text)" : "var(--text-2)",
            }}
            title={expanded ? undefined : label}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className={expanded ? "hidden truncate lg:inline" : "sr-only"}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r py-4 transition-[width] duration-200 ease-out md:flex ${
          railExpanded ? "w-16 px-2 lg:w-56 lg:px-3" : "w-16 px-2"
        }`}
        style={{
          background: "var(--sidebar)",
          borderColor: "var(--border)",
        }}
      >
        <div
          className={`flex items-center ${
            railExpanded ? "justify-center lg:justify-between" : "justify-center"
          }`}
        >
          <BrandMark expanded={railExpanded} />
          {railExpanded && (
            <button
              type="button"
              onClick={toggleRail}
              className="hidden h-8 w-8 place-items-center rounded-md outline-none transition-colors hover:bg-[var(--surface-1)] focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] lg:grid"
              style={{ color: "var(--text-2)" }}
              aria-label="Collapse navigation"
              title="Collapse navigation"
            >
              <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
        {!railExpanded && (
          <button
            type="button"
            onClick={toggleRail}
            className="mt-4 hidden h-9 w-full place-items-center rounded-md outline-none transition-colors hover:bg-[var(--surface-1)] focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] lg:grid"
            style={{ color: "var(--text-2)" }}
            aria-label="Expand navigation"
            title="Expand navigation"
          >
            <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        <div className="mt-6 flex-1">{renderNav(railExpanded)}</div>
        <button
          type="button"
          onClick={logout}
          className={`flex items-center rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors hover:bg-[var(--surface-1)] focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] ${
            railExpanded ? "justify-center lg:justify-start lg:gap-3" : "justify-center"
          }`}
          style={{ color: "var(--text-2)" }}
          title={railExpanded ? undefined : "Log out"}
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className={railExpanded ? "hidden truncate lg:inline" : "sr-only"}>
            Log out
          </span>
        </button>
      </aside>

      <header
        className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b px-3 md:hidden"
        style={{
          background: "var(--sidebar)",
          borderColor: "var(--border)",
        }}
      >
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="grid h-9 w-9 place-items-center rounded-md outline-none transition-colors hover:bg-[var(--surface-1)] focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0 text-center">
          <div className="truncate text-sm font-semibold tracking-tight">
            {title || "Q-Chess"}
          </div>
          {subtitle && (
            <div className="truncate text-[11px]" style={{ color: "var(--text-3)" }}>
              {subtitle}
            </div>
          )}
        </div>
        <Link
          href="/"
          className="grid h-9 w-9 place-items-center rounded-md outline-none transition-colors hover:bg-[var(--surface-1)] focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]"
          aria-label="Back to play"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/55" aria-hidden="true" />
          <div
            ref={panelRef}
            className="relative flex h-full w-72 flex-col border-r px-4 py-4"
            style={{
              background: "var(--sidebar)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div className="flex items-center justify-between">
              <BrandMark expanded labelAlways />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-md outline-none transition-colors hover:bg-[var(--surface-1)] focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-7 flex-1">{renderNav(true)}</div>
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors hover:bg-[var(--surface-1)] focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]"
              style={{ color: "var(--text-2)" }}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Log out
            </button>
          </div>
        </div>
      )}

      <main
        className={`min-h-screen pt-14 transition-[padding-left] duration-200 ease-out md:pt-0 ${
          railExpanded ? "md:pl-16 lg:pl-56" : "md:pl-16"
        } ${className}`}
      >
        <div
          className={
            variant === "game"
              ? "min-h-screen"
              : "mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 md:px-8"
          }
        >
          {showHeader && variant !== "game" && (title || subtitle || actions) && (
            <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                {title && (
                  <h1 className="text-2xl font-semibold tracking-tight">
                    {title}
                  </h1>
                )}
                {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
              </div>
              {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
            </header>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}

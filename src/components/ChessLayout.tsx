"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Archive,
  CirclePlay,
  Crown,
  House,
  LogOut,
  Menu,
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
  const panelRef = useRef<HTMLDivElement | null>(null);

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

  const renderNav = (expanded: boolean) => (
    <nav className="space-y-1" aria-label="Primary navigation">
      {navItems.map(({ href, label, Icon }) => {
        const active = isActivePath(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={(event) => guardedNav(event, href)}
            className={`group flex items-center rounded-md text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] ${
              expanded
                ? "gap-3 px-3 py-2"
                : "h-10 w-10 justify-center"
            }`}
            style={{
              background: active ? "var(--accent-soft)" : "transparent",
              color: active ? "var(--text)" : "var(--text-3)",
            }}
            title={label}
            aria-label={expanded ? undefined : label}
          >
            <Icon className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden="true" />
            <span className={expanded ? "truncate" : "sr-only"}>
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
        className="fixed inset-y-0 left-0 z-40 hidden w-[4.5rem] flex-col items-center border-r px-2 py-4 md:flex"
        style={{
          background: "var(--sidebar)",
          borderColor: "var(--border)",
        }}
      >
        <BrandMark expanded={false} />
        <div className="mt-7 flex flex-1 justify-center">{renderNav(false)}</div>
        <button
          type="button"
          onClick={logout}
          className="grid h-10 w-10 place-items-center rounded-md text-sm font-medium outline-none transition-colors hover:bg-[var(--surface-1)] focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]"
          style={{ color: "var(--text-3)" }}
          title="Log out"
          aria-label="Log out"
        >
          <LogOut className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden="true" />
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
          aria-label="Go to lobby"
        >
          <House className="h-5 w-5" />
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
        className={`min-h-screen pt-14 md:pl-[4.5rem] md:pt-0 ${className}`}
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

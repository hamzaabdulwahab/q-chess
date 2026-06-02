"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Archive,
  Grid3X3,
  House,
  Menu,
  PanelLeft,
  Play,
  X,
} from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { BrandLogo } from "@/components/BrandLogo";

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
  { href: "/", label: "Play", Icon: Play },
  { href: "/board", label: "Board", Icon: Grid3X3 },
  { href: "/archive", label: "Archive", Icon: Archive },
];

type SidebarProfile = {
  email: string | null;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

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
      <BrandLogo />
      <span
        className={`text-xl font-semibold tracking-tight ${
          expanded ? (labelAlways ? "inline" : "hidden lg:inline") : "sr-only"
        }`}
      >
        Q-Chess
      </span>
    </Link>
  );
}

function profileInitial(profile: SidebarProfile | null) {
  const source =
    profile?.full_name || profile?.username || profile?.email || "Q";
  return source.trim().slice(0, 1).toUpperCase() || "Q";
}

function SidebarAccount({
  expanded,
  profile,
}: {
  expanded: boolean;
  profile: SidebarProfile | null;
}) {
  const displayName =
    profile?.full_name || profile?.username || profile?.email || "Q-Chess";
  const username = profile?.username ? `@${profile.username}` : "View profile";
  const avatarSize = expanded ? 38 : 36;

  return (
    <Link
      href="/profile"
      className={`flex min-w-0 items-center rounded-md outline-none transition-colors hover:bg-[var(--surface-1)] focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] ${
        expanded ? "w-full gap-3 p-2" : "h-10 w-10 justify-center"
      }`}
      title={displayName}
      aria-label={expanded ? undefined : "View profile"}
    >
      <span
        className="grid shrink-0 place-items-center overflow-hidden rounded-full border text-sm font-semibold"
        style={{
          width: avatarSize,
          height: avatarSize,
          background: "var(--avatar-fallback)",
          borderColor:
            "color-mix(in oklch, var(--avatar-fallback) 78%, white 16%)",
          color: "white",
        }}
      >
        {profile?.avatar_url ? (
          <Image
            src={profile.avatar_url}
            alt=""
            width={avatarSize}
            height={avatarSize}
            unoptimized
            className="h-full w-full object-cover"
          />
        ) : (
          profileInitial(profile)
        )}
      </span>
      {expanded && (
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-semibold">
            {displayName}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted">
            {username}
          </span>
        </span>
      )}
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
  const [desktopExpanded, setDesktopExpanded] = useState(false);
  const [toggleHovered, setToggleHovered] = useState(false);
  const [profile, setProfile] = useState<SidebarProfile | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      setDesktopExpanded(
        window.localStorage.getItem("q-chess.sidebarExpanded") === "true",
      );
    } catch {
      setDesktopExpanded(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as SidebarProfile;
        if (!cancelled) setProfile(json);
      } catch {
        // The sidebar can render without account metadata.
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleDesktopSidebar = () => {
    setDesktopExpanded((expanded) => {
      const nextExpanded = !expanded;
      try {
        window.localStorage.setItem(
          "q-chess.sidebarExpanded",
          String(nextExpanded),
        );
      } catch {
        // The navigation still works if browser storage is unavailable.
      }
      return nextExpanded;
    });
    setToggleHovered(false);
  };

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
            <AppIcon icon={Icon} className="h-5 w-5 shrink-0" />
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
        className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r py-4 transition-[width,padding] duration-200 ease-out md:flex ${
          desktopExpanded
            ? "w-56 items-stretch px-3"
            : "w-[4.5rem] items-center px-2"
        }`}
        style={{
          background: "var(--sidebar)",
          borderColor: "var(--border)",
        }}
      >
        <button
          type="button"
          onClick={toggleDesktopSidebar}
          onMouseEnter={() => {
            if (!desktopExpanded) setToggleHovered(true);
          }}
          onMouseLeave={() => setToggleHovered(false)}
          onFocus={() => {
            if (!desktopExpanded) setToggleHovered(true);
          }}
          onBlur={() => setToggleHovered(false)}
          className={`flex h-10 min-w-0 items-center rounded-md outline-none transition-colors hover:bg-[var(--surface-1)] focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] ${
            desktopExpanded ? "w-full justify-between gap-3 px-3" : "w-10 justify-center"
          }`}
          aria-expanded={desktopExpanded}
          aria-label={desktopExpanded ? "Collapse navigation" : "Expand navigation"}
          title={desktopExpanded ? "Collapse navigation" : "Expand navigation"}
        >
          {desktopExpanded ? (
            <>
              <span className="truncate text-xl font-semibold tracking-tight">
                Q-Chess
              </span>
              <AppIcon icon={PanelLeft} className="h-5 w-5 shrink-0 text-white" />
            </>
          ) : (
            <span className="relative grid h-9 w-9 shrink-0 place-items-center">
              <span
                className={`absolute inset-0 grid place-items-center transition-opacity duration-150 ease-out ${
                  toggleHovered ? "opacity-0" : "opacity-100"
                }`}
              >
                <BrandLogo size="sm" />
              </span>
              <AppIcon
                icon={PanelLeft}
                className={`h-5 w-5 text-white transition-opacity duration-150 ease-out ${
                  toggleHovered ? "opacity-100" : "opacity-0"
                }`}
              />
            </span>
          )}
        </button>

        <div
          className={`mt-7 flex flex-1 ${
            desktopExpanded ? "w-full flex-col" : "justify-center"
          }`}
        >
          {renderNav(desktopExpanded)}
        </div>

        <SidebarAccount expanded={desktopExpanded} profile={profile} />
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
          <AppIcon icon={Menu} className="h-5 w-5" />
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
          <AppIcon icon={House} className="h-5 w-5" />
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
                <AppIcon icon={X} className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-7 flex-1">{renderNav(true)}</div>
            <SidebarAccount expanded profile={profile} />
          </div>
        </div>
      )}

      <main
        className={`min-h-screen pt-14 transition-[padding] duration-200 ease-out md:pt-0 ${
          desktopExpanded ? "md:pl-56" : "md:pl-[4.5rem]"
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

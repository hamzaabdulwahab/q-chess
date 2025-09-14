"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { useEffect, useRef, useState } from "react";
import { Bell, Home, User, LogOut, ChevronDown } from "lucide-react";

function InvitesBell() {
  const [open, setOpen] = useState(false);
  const SOURCE = "invites-bell";
  // Menu is right-anchored; dynamic positioning removed for simplicity.
  const [items, setItems] = useState<
    Array<{
      id: string;
      status: string;
      from_user?: string;
      from_profile?: { username?: string | null } | null;
      expires_at?: string;
      room_id?: string;
    }>
  >([]);
  const bellRef = useRef<HTMLDivElement | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  const load = async () => {
    try {
      const res = await fetch("/api/invites", { cache: "no-store" });
      const json = await res.json();
      if (res.ok) setItems(json.invites || []);
    } catch {}
  };
  useEffect(() => {
    load();
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, []);
  // tick countdowns
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  // Static right-anchored menu; no dynamic positioning needed
  useEffect(() => {
    if (!open) return;
  }, [open]);

  // Close if another dropdown announces it opened
  useEffect(() => {
    const onOtherOpen = (ev: Event) => {
      const detail = (ev as CustomEvent<{ source?: string }>).detail;
      if (detail?.source !== SOURCE) setOpen(false);
    };
    window.addEventListener(
      "dropdown:open" as unknown as keyof WindowEventMap,
      onOtherOpen as EventListener
    );
    return () => {
      window.removeEventListener(
        "dropdown:open" as unknown as keyof WindowEventMap,
        onOtherOpen as EventListener
      );
    };
  }, []);

  // Close notification menu on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (ev: MouseEvent | TouchEvent) => {
      const el = bellRef.current;
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

  // Realtime: subscribe to invites addressed to this user (to_user)
  useEffect(() => {
    let unsub = () => {};
    const supabase = getSupabaseBrowser();
    // Get user id once and then bind channel
    supabase.auth.getUser().then(({ data }) => {
      const id = data.user?.id;
      if (!id) return;
      const channel = supabase
        .channel(`invites-to-${id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "invites",
            filter: `to_user=eq.${id}`,
          } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
          () => {
            // Any change to invites for me -> refresh list
            load();
          }
        )
        .subscribe();
      unsub = () => {
        try {
          supabase.removeChannel(channel);
        } catch {}
      };
    });
    return () => unsub();
  }, []);
  const act = async (id: string, action: "accepted" | "declined") => {
    const res = await fetch(`/api/invites/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const json = await res.json();
    await load();
    if (action === "accepted" && res.ok) {
      window.location.href = `/online?room=${json.invite.room_id}`;
    }
  };
  return (
    <div ref={bellRef} className="relative">
      <button
        onClick={() =>
          setOpen((v) => {
            const next = !v;
            if (next) {
              window.dispatchEvent(
                new CustomEvent("dropdown:open", { detail: { source: SOURCE } })
              );
            }
            return next;
          })
        }
        className={`w-10 h-10 rounded-lg bg-gray-800/90 border border-gray-700 text-white grid place-items-center shadow transition-all duration-200 ${
          open
            ? "bg-violet-600 border-violet-500 scale-105"
            : "hover:bg-gray-700 hover:border-gray-600"
        }`}
        title="Invites"
      >
        <span
          className={`transition-transform duration-200 ${
            open ? "scale-110" : ""
          }`}
        >
          <Bell className="w-5 h-5" aria-hidden />
        </span>
        {items.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] px-1 rounded-full animate-pulse">
            {items.length}
          </span>
        )}
        {/* Dropdown Arrow */}
        <ChevronDown
          className={`absolute -bottom-1 right-2 w-3 h-3 text-gray-800 transition-all duration-200 ${
            open ? "opacity-100 scale-100" : "opacity-0 scale-75"
          }`}
          aria-hidden
        />
      </button>
      <div
        className={`absolute mt-3 w-64 rounded-lg border border-gray-700 bg-gray-900/95 backdrop-blur-sm text-sm text-gray-200 shadow-xl transition-all duration-200 right-0 origin-top-right ${
          open
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 translate-y-[-10px] pointer-events-none"
        }`}
        style={{
          maxHeight: "calc(100vh - 120px)",
          overflowY: "auto",
        }}
      >
        {/* Dropdown Arrow */}
        <div
          className={`absolute -top-1.5 right-3 w-3 h-3 bg-gray-900 border-l border-t border-gray-700 rotate-45`}
        ></div>
        <div className="p-3">
          <div className="text-xs text-gray-400 mb-2 font-medium">
            Pending invites
          </div>
          {items.length === 0 ? (
            <div className="text-xs text-gray-400 py-6 text-center">
              No invites
            </div>
          ) : (
            <ul className="space-y-2 max-h-64 overflow-auto">
              {items.map((i, index) => (
                <li
                  key={i.id}
                  className={`flex items-center justify-between gap-2 bg-gray-800 rounded p-3 transition-all duration-200 hover:bg-gray-750 ${
                    open ? "animate-in slide-in-from-right-2" : ""
                  }`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="text-xs">
                    <span className="text-gray-400">From:</span>{" "}
                    <span className="font-medium text-white">
                      {i.from_profile?.username || "Unknown"}
                    </span>
                    {i.expires_at && (
                      <div className="text-[10px] text-gray-400 mt-1">
                        Expires in{" "}
                        {Math.max(
                          0,
                          Math.ceil(
                            (new Date(i.expires_at).getTime() - now) / 1000
                          )
                        )}
                        s
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      className="text-xs px-3 py-1.5 rounded bg-violet-600 hover:bg-violet-500 transition-colors duration-200 font-medium"
                      onClick={() => act(i.id, "accepted")}
                    >
                      Accept
                    </button>
                    <button
                      className="text-xs px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 transition-colors duration-200"
                      onClick={() => act(i.id, "declined")}
                    >
                      Decline
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export function FloatingUserMenu() {
  const pathname = usePathname() ?? "";
  const isHome = pathname === "/";
  const isProfile = pathname.startsWith("/profile");
  const [open, setOpen] = useState(false);
  const SOURCE = "user-menu";
  // Right-anchored menu; dynamic flipping removed
  const rootRef = useRef<HTMLDivElement | null>(null);

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(false);
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
    window.location.href = "/auth/signin";
  };

  const guardedNav = (e: React.MouseEvent, href: string) => {
    // Always close menu on click
    setOpen(false);
    if ((window as unknown as Record<string, unknown>).__PROFILE_DIRTY__) {
      e.preventDefault();
      window.dispatchEvent(
        new CustomEvent("profile-guard", { detail: { href } })
      );
    }
  };

  // Static right-anchored; no dynamic positioning
  useEffect(() => {
    if (!open) return;
  }, [open]);

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
      onOtherOpen as EventListener
    );
    return () => {
      window.removeEventListener(
        "dropdown:open" as unknown as keyof WindowEventMap,
        onOtherOpen as EventListener
      );
    };
  }, []);

  if (pathname.startsWith("/auth")) return null;

  return (
    <div
      ref={rootRef}
      className="fixed top-6 right-6 z-50 flex items-center gap-2"
    >
      <InvitesBell />
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
                  })
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
          className={`absolute mt-3 w-48 rounded-lg border border-gray-700 bg-gray-900/95 backdrop-blur-sm text-sm text-gray-200 shadow-xl transition-all duration-200 right-0 origin-top-right ${
            open
              ? "opacity-100 scale-100 translate-y-0"
              : "opacity-0 scale-95 translate-y-[-10px] pointer-events-none"
          }`}
          style={{
            maxHeight: "calc(100vh - 120px)",
            overflowY: "auto",
          }}
        >
          {/* Dropdown Arrow (menu corner) */}
          <div
            className={`absolute -top-1.5 right-3 w-3 h-3 bg-gray-900 border-l border-t border-gray-700 rotate-45`}
          ></div>
          <nav className="py-2">
            <Link
              href="/"
              onClick={(e) => guardedNav(e, "/")}
              className={`block px-4 py-2.5 transition-all duration-200 ${
                isHome
                  ? "text-accent bg-accent-ghost"
                  : "hover:bg-gray-800 hover:text-white"
              }`}
            >
              <span className="flex items-center gap-2">
                <Home className="w-4 h-4" aria-hidden />
                For My Queen
              </span>
            </Link>
            <Link
              href="/profile"
              onClick={(e) => guardedNav(e, "/profile")}
              className={`block px-4 py-2.5 transition-all duration-200 ${
                isProfile
                  ? "text-accent bg-accent-ghost"
                  : "hover:bg-gray-800 hover:text-white"
              }`}
            >
              <span className="flex items-center gap-2">
                <User className="w-4 h-4" aria-hidden />
                Profile
              </span>
            </Link>
            <div className="border-t border-gray-700 my-1"></div>
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2.5 hover:bg-red-600/20 hover:text-red-400 transition-all duration-200"
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
    </div>
  );
}

// no default export

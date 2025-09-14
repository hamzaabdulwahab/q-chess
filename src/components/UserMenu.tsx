"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

export function UserMenu() {
  const pathname = usePathname() ?? "";
  const isHome = pathname === "/";
  const isProfile = pathname.startsWith("/profile");
  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
    window.location.href = "/auth/signin";
  };

  return (
    <nav className="flex items-center gap-5 text-sm">
      <Link
        href="/"
        onClick={(e) => {
          if (
            (window as unknown as Record<string, unknown>).__PROFILE_DIRTY__
          ) {
            e.preventDefault();
            window.dispatchEvent(
              new CustomEvent("profile-guard", { detail: { href: "/" } })
            );
          }
        }}
        className={isHome ? "text-accent" : "text-gray-300 hover:text-white"}
      >
        For My Queen
      </Link>
      <Link
        href="/profile"
        onClick={(e) => {
          if (
            (window as unknown as Record<string, unknown>).__PROFILE_DIRTY__
          ) {
            e.preventDefault();
            window.dispatchEvent(
              new CustomEvent("profile-guard", { detail: { href: "/profile" } })
            );
          }
        }}
        className={isProfile ? "text-accent" : "text-gray-300 hover:text-white"}
      >
        Profile
      </Link>
      <button
        onClick={handleLogout}
        className="text-gray-300 hover:text-white"
        type="button"
      >
        Log out
      </button>
    </nav>
  );
}

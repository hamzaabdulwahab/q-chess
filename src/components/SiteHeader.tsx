"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserMenu } from "./UserMenu";

// Hides the header on auth routes like /auth/signin, /auth/signup, /auth/callback
export function SiteHeader() {
  const pathname = usePathname() ?? "";
  if (pathname.startsWith("/auth")) return null;
  const isHome = pathname === "/";

  return (
    <header className="w-full bg-gray-950/80 border-b border-gray-800 text-white">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link
          href="/"
          className={
            "text-sm font-semibold transition-colors " +
            (isHome ? "text-accent" : "text-gray-200 hover:text-accent")
          }
        >
          Q-Chess
        </Link>
        <UserMenu />
      </div>
    </header>
  );
}

"use client";
export const dynamic = "force-dynamic";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

export default function SignIn() {
  const router = useRouter();
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const last = window.localStorage.getItem("last_email");
      if (last) setEmail(last);
      const rememberFlag = window.localStorage.getItem("remember_me");
      if (rememberFlag != null) setRemember(rememberFlag === "1");
      const url = new URL(window.location.href);
      const r = url.searchParams.get("redirectTo");
      if (r) setRedirectTo(r);
    }
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Enter your email address.");
      return;
    }
    if (!/.+@.+\..+/.test(trimmedEmail)) {
      setError("That doesn't look like a valid email.");
      return;
    }
    setLoading(true);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("remember_me", remember ? "1" : "0");
        if (remember) {
          window.localStorage.setItem("last_email", trimmedEmail);
        } else {
          window.localStorage.removeItem("last_email");
        }
      }
      const supabase = getSupabaseBrowser();
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (signErr) throw signErr;
      await fetch("/api/ensure-profile", { method: "POST" });
      router.replace(redirectTo || "/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid credentials";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-chessgrid relative min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Wordmark */}
        <div className="mb-10 flex items-center justify-center gap-3">
          <span
            className="grid h-9 w-9 place-items-center rounded-md text-base"
            style={{
              background: "var(--text)",
              color: "var(--accent-fg)",
              fontWeight: 700,
            }}
          >
            ♞
          </span>
          <span
            className="text-xl font-semibold tracking-tight"
            style={{ color: "var(--text)" }}
          >
            Q-chess
          </span>
        </div>

        {/* Card */}
        <div className="surface-card p-7" style={{ boxShadow: "var(--shadow)" }}>
          <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-muted">
            Sign in to resume your games.
          </p>

          {error && (
            <div
              className="mt-5 rounded-md px-3 py-2 text-sm"
              style={{
                background: "var(--danger-soft)",
                color: "var(--text)",
                border:
                  "1px solid color-mix(in oklch, var(--danger) 40%, transparent)",
              }}
              role="alert"
            >
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="signin-email"
                className="mb-1.5 block text-xs font-medium"
                style={{ color: "var(--text-2)" }}
              >
                Email
              </label>
              <input
                id="signin-email"
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                autoFocus
              />
            </div>
            <div>
              <label
                htmlFor="signin-password"
                className="mb-1.5 flex items-center justify-between text-xs font-medium"
                style={{ color: "var(--text-2)" }}
              >
                <span>Password</span>
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="inline-flex items-center gap-1 text-[11px] transition-colors hover:text-[var(--text)]"
                  style={{ color: "var(--text-3)" }}
                >
                  {showPassword ? (
                    <EyeOff className="h-3 w-3" />
                  ) : (
                    <Eye className="h-3 w-3" />
                  )}
                  {showPassword ? "Hide" : "Show"}
                </button>
              </label>
              <input
                id="signin-password"
                type={showPassword ? "text" : "password"}
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <label
              htmlFor="remember"
              className="flex cursor-pointer select-none items-center gap-2 text-sm"
              style={{ color: "var(--text-2)" }}
            >
              <input
                id="remember"
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-3.5 w-3.5"
                style={{ accentColor: "oklch(0.85 0.003 250)" }}
              />
              Keep me signed in
            </label>

            <button
              type="submit"
              disabled={loading}
              className="btn-accent inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm"
            >
              {loading ? (
                "Signing in…"
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Sign in
                </>
              )}
            </button>
          </form>
        </div>

        <p
          className="mt-6 text-center text-sm"
          style={{ color: "var(--text-3)" }}
        >
          New to Q-chess?{" "}
          <Link
            href="/auth/signup"
            className="font-medium underline-offset-4 hover:underline"
            style={{ color: "var(--text)" }}
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

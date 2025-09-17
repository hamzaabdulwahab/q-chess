"use client";
export const dynamic = "force-dynamic";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { Alert } from "@/components/Alert";

export default function SignIn() {
  const router = useRouter();
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState(""); // username or email
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const last = window.localStorage.getItem("last_username");
      if (last) setIdentifier(last);
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
    setNotice(null);
    const raw = identifier.trim();
    if (!raw) {
      setError("Please enter your username or email.");
      return;
    }
    setLoading(true);
    try {
      // Persist choice so our browser client sets persistSession accordingly
      if (typeof window !== "undefined") {
        window.localStorage.setItem("remember_me", remember ? "1" : "0");
        // Optionally remember username for autofill convenience
        if (remember) {
          window.localStorage.setItem("last_username", raw);
        } else {
          window.localStorage.removeItem("last_username");
        }
      }
      const supabase = getSupabaseBrowser();
      // Determine email (username -> email lookup when needed)
      let email = raw;
      const looksLikeEmail = /.+@.+\..+/.test(raw);
      if (!looksLikeEmail) {
        // Try username lookup, but fall back gracefully
        try {
          const res = await fetch("/api/resolve-username", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: raw.toLowerCase() }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            if (
              res.status === 503 &&
              data?.error === "username_lookup_unavailable"
            ) {
              throw new Error(
                "Username lookup is currently unavailable. Please sign in with your email address instead."
              );
            }
            throw new Error(data?.error || "Username not found. Please use your email address.");
          }
          const data = await res.json();
          email = data.email;
        } catch (error) {
          // If username lookup fails, suggest using email
          const errorMsg = error instanceof Error ? error.message : "Username lookup failed";
          throw new Error(
            errorMsg.includes("unavailable") ? errorMsg : 
            "Unable to find username. Please sign in with your email address instead."
          );
        }
      }
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signErr) throw signErr;
      // Ensure profile exists for returning users
      await fetch("/api/ensure-profile", { method: "POST" });
      router.replace(redirectTo || "/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid credentials";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const onMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const raw = identifier.trim();
    if (!raw) return setError("Enter your email or username.");
    setLoading(true);
    try {
      let email = raw;
      const looksLikeEmail = /.+@.+\..+/.test(raw);
      if (!looksLikeEmail) {
        const res = await fetch("/api/resolve-username", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: raw.toLowerCase() }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "Username not found");
        }
        const data = await res.json();
        email = data.email;
      }
      const supabase = getSupabaseBrowser();
      const { error: mlErr } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (mlErr) throw mlErr;
      setNotice("Magic link sent. Check your email.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send link";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-gray-800/60 backdrop-blur rounded-xl p-6 border border-gray-700">
        <h1 className="text-2xl font-semibold mb-2">Sign in</h1>
        <p className="text-sm text-gray-300 mb-6">
          Enter your email address and password. Username login may be temporarily unavailable.
        </p>
        {error && (
          <div aria-live="polite">
            <Alert variant="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          </div>
        )}
        {notice && (
          <div aria-live="polite">
            <Alert variant="success" onClose={() => setNotice(null)}>
              {notice}
            </Alert>
          </div>
        )}
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">
              Email (Recommended) or Username
            </label>
            <div className="flex items-center rounded-lg bg-gray-900 border border-gray-700 focus-within:border-accent">
              <input
                className="w-full bg-transparent px-3 py-2 outline-none"
                placeholder="you@example.com or username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Email address is recommended for reliable sign-in.
            </p>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Password</label>
            <input
              type="password"
              className="w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 outline-none focus:border-accent"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="remember"
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 accent-violet-600"
            />
            <label htmlFor="remember" className="text-sm text-gray-300">
              Remember me
            </label>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full btn-accent disabled:opacity-60 text-black rounded-lg px-4 py-2 font-medium"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <button
            onClick={onMagicLink}
            disabled={loading}
            className="w-full mt-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg px-4 py-2 font-medium border border-gray-600"
          >
            {loading ? "Sending…" : "Send Magic Link"}
          </button>
        </form>

        <div className="text-sm text-gray-300 mt-6">
          New here?{" "}
          <a href="/auth/signup" className="link-accent hover:underline">
            Create account
          </a>
        </div>
      </div>
    </div>
  );
}

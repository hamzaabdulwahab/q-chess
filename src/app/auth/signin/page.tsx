"use client";
export const dynamic = "force-dynamic";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { Alert } from "@/components/Alert";

export default function SignIn() {
  const router = useRouter();
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [email, setEmail] = useState(""); // email only
  const [password, setPassword] = useState("");
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
      setError("Please enter your email address.");
      return;
    }
    if (!/.+@.+\..+/.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    
    setLoading(true);
    try {
      // Persist choice so our browser client sets persistSession accordingly
      if (typeof window !== "undefined") {
        window.localStorage.setItem("remember_me", remember ? "1" : "0");
        // Remember email for autofill convenience
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

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-gray-800/60 backdrop-blur rounded-xl p-6 border border-gray-700">
        <h1 className="text-2xl font-semibold mb-2">Sign in</h1>
        <p className="text-sm text-gray-300 mb-6">
          Enter your email address and password.
        </p>
        {error && (
          <div aria-live="polite">
            <Alert variant="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          </div>
        )}
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">
              Email
            </label>
            <div className="flex items-center rounded-lg bg-gray-900 border border-gray-700 focus-within:border-accent">
              <input
                type="email"
                className="w-full bg-transparent px-3 py-2 outline-none"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
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

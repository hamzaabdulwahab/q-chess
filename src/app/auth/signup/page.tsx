"use client";
export const dynamic = "force-dynamic";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { Alert } from "@/components/Alert";

function isValidEmail(email: string) {
  return /.+@.+\..+/.test(email);
}

type Strength = "weak" | "fair" | "good" | "strong";

function assessPassword(pw: string) {
  const length = pw.length >= 8;
  const lower = /[a-z]/.test(pw);
  const upper = /[A-Z]/.test(pw);
  const digit = /\d/.test(pw);
  const special = /[^A-Za-z0-9]/.test(pw);
  const passed = [length, lower, upper, digit, special].filter(Boolean).length;
  const strength: Strength =
    passed <= 2
      ? "weak"
      : passed === 3
      ? "fair"
      : passed === 4
      ? "good"
      : "strong";
  return { length, lower, upper, digit, special, passed, strength };
}

function classForStrength(s: Strength) {
  switch (s) {
    case "weak":
      return "bg-red-500 w-1/4";
    case "fair":
      return "bg-yellow-500 w-2/4";
    case "good":
      return "bg-lime-500 w-3/4";
    case "strong":
      return "bg-green-600 w-full";
  }
}

function suggestUsernames(base: string): string[] {
  // allow only alphanumerics in suggestions
  const trimmed = base.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const rand = (n: number) => Math.floor(Math.random() * n);
  const year = new Date().getFullYear();
  const alphas = "abcdefghijklmnopqrstuvwxyz";
  const two = alphas[rand(26)] + alphas[rand(26)];
  return [
    `${trimmed}${100 + rand(900)}`,
    `${trimmed}${two}`,
    `${trimmed}${year}`,
    `${trimmed}${rand(99)}`,
    `${trimmed}${rand(9999)}`,
  ];
}

export default function SignUp() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [invalidAttempt, setInvalidAttempt] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const check = useMemo(() => assessPassword(password), [password]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuggestions([]);
    const clean = username.trim().toLowerCase();
    if (!clean || clean.length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }
    if (!/^[a-z0-9]+$/i.test(clean)) {
      setError("Username can contain only letters and numbers.");
      return;
    }
    const full = fullName.trim();
    if (!full) {
      setError("Please enter your full name.");
      return;
    }
    const emailClean = email.trim();
    if (!isValidEmail(emailClean)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!(check.length && check.lower && check.upper && check.digit)) {
      setError("Password must be 8+ chars with upper, lower, and a number.");
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      // Check username availability in profiles
      const { data: existing, error: selErr } = await supabase
        .from("profiles")
        .select("username")
        .eq("username", clean)
        .limit(1);
      if (selErr) throw selErr;
      if (existing && existing.length > 0) {
        setError("Username is taken. Try one of these suggestions.");
        setSuggestions(suggestUsernames(clean));
        setLoading(false);
        return;
      }

      // Create auth user with provided email
      const { data: signData, error: signErr } = await supabase.auth.signUp({
        email: emailClean,
        password,
        options: {
          data: { username: clean, full_name: full },
          emailRedirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/auth/callback`
              : undefined,
        },
      });
      if (signErr || !signData.user)
        throw signErr || new Error("Sign up failed");

      // Some projects return no session on signUp (email confirmations on). Try sign-in to establish a session when allowed.
      if (!signData.session) {
        const { error: siErr } = await supabase.auth.signInWithPassword({
          email: emailClean,
          password,
        });
        if (siErr) {
          setError(
            "Sign-up succeeded but no session. Please disable email confirmation in Supabase or confirm your email."
          );
          setLoading(false);
          return;
        }
      }

      // Ensure profile exists via authenticated API (avoids trigger timing issues)
      const ensureRes = await fetch("/api/ensure-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: clean }),
      });
      if (!ensureRes.ok) {
        await supabase.auth.signOut();
        const data = await ensureRes.json().catch(() => ({}));
        setError(data?.error || "Profile creation failed. Please try again.");
        setLoading(false);
        return;
      }

      // Profile is auto-created by DB trigger using the username in user metadata.

      // Done: go home
      router.replace("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-gray-800/60 backdrop-blur rounded-xl p-6 border border-gray-700">
        <h1 className="text-2xl font-semibold mb-2">Create your account</h1>
        <p className="text-sm text-gray-300 mb-6">
          Pick a username (letters and numbers only) and a strong password.
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
              Full Name
            </label>
            <input
              type="text"
              className="w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 outline-none focus:border-accent"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              placeholder="Your full name"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Username</label>
            <div className="flex items-center rounded-lg bg-gray-900 border border-gray-700 focus-within:border-accent">
              <span className="px-3 text-gray-400">@</span>
              <input
                className="w-full bg-transparent px-3 py-2 outline-none"
                placeholder="yourname"
                value={username}
                onChange={(e) => {
                  const raw = e.target.value;
                  const sanitized = raw.replace(/[^a-zA-Z0-9]/g, "");
                  setInvalidAttempt(raw !== sanitized);
                  setUsername(sanitized);
                }}
                autoComplete="username"
                required
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              No special characters allowed.
            </p>
            {invalidAttempt && (
              <p className="text-xs text-red-400 mt-1">
                Only letters and numbers are allowed.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Email</label>
            <input
              type="email"
              className="w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 outline-none focus:border-accent"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              We&apos;ll send confirmations here.
            </p>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Password</label>
            <input
              type="password"
              className="w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 outline-none focus:border-accent"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
            <div className="h-2 bg-gray-700 rounded mt-2 overflow-hidden">
              <div
                className={`h-full ${classForStrength(
                  check.strength
                )} transition-all`}
              ></div>
            </div>
            <ul className="text-xs text-gray-300 mt-2 space-y-1">
              <li className={check.length ? "text-green-400" : "text-gray-400"}>
                8+ characters
              </li>
              <li className={check.lower ? "text-green-400" : "text-gray-400"}>
                lowercase letter
              </li>
              <li className={check.upper ? "text-green-400" : "text-gray-400"}>
                uppercase letter
              </li>
              <li className={check.digit ? "text-green-400" : "text-gray-400"}>
                number
              </li>
              <li
                className={check.special ? "text-green-400" : "text-gray-400"}
              >
                special character
              </li>
            </ul>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              className="w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 outline-none focus:border-accent"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-accent disabled:opacity-60 text-black rounded-lg px-4 py-2 font-medium"
          >
            {loading ? "Creating account…" : "Sign up"}
          </button>
        </form>

        {suggestions.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-gray-300 mb-1">Suggestions:</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setUsername(s)}
                  className="text-sm bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded"
                >
                  @{s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="text-sm text-gray-300 mt-6">
          Already have an account?{" "}
          <a href="/auth/signin" className="link-accent hover:underline">
            Sign in
          </a>
        </div>
      </div>
    </div>
  );
}

"use client";
export const dynamic = "force-dynamic";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

function isValidEmail(email: string) {
  return /.+@.+\..+/.test(email);
}

type Strength = "weak" | "fair" | "good" | "strong";

interface PasswordAssessment {
  length: boolean;
  lower: boolean;
  upper: boolean;
  digit: boolean;
  special: boolean;
  passed: number;
  strength: Strength;
  isCommonWeak: boolean;
}

function assessPassword(pw: string): PasswordAssessment {
  const length = pw.length >= 8;
  const lower = /[a-z]/.test(pw);
  const upper = /[A-Z]/.test(pw);
  const digit = /\d/.test(pw);
  const special = /[^A-Za-z0-9]/.test(pw);
  const passed = [length, lower, upper, digit, special].filter(Boolean).length;
  const commonWeak = [
    "password",
    "password123",
    "123456789",
    "qwerty123",
    "admin123",
    "letmein123",
    "welcome123",
    "password1",
    "abc123456",
    "123456abc",
    "passw0rd",
    "p@ssw0rd",
  ];
  const isCommonWeak = commonWeak.includes(pw.toLowerCase());
  const strength: Strength =
    isCommonWeak || passed <= 2
      ? "weak"
      : passed === 3
        ? "fair"
        : passed === 4
          ? "good"
          : "strong";
  return { length, lower, upper, digit, special, passed, strength, isCommonWeak };
}

function strengthMeta(s: Strength) {
  switch (s) {
    case "weak":
      return { pct: 25, label: "Weak", color: "var(--danger)" };
    case "fair":
      return { pct: 50, label: "Fair", color: "var(--warning)" };
    case "good":
      return { pct: 75, label: "Good", color: "oklch(0.75 0.10 110)" };
    case "strong":
      return { pct: 100, label: "Strong", color: "var(--success)" };
  }
}

function suggestUsernames(base: string): string[] {
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
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const check = useMemo(() => assessPassword(password), [password]);
  const strength = strengthMeta(check.strength);
  const passwordsMatch =
    confirm.length > 0 && password.length > 0 && password === confirm;

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
    if (check.isCommonWeak) {
      setError(
        "This password is too common. Please choose a more unique password.",
      );
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();

      const { data: validation, error: validationError } = await supabase.rpc(
        "validate_user_signup",
        {
          email: emailClean,
          password: password,
        },
      );
      if (validationError?.code === "PGRST202") {
        // The migration that installs validate_user_signup may not be present
        // on older environments yet. The same validation already ran locally.
      } else if (validationError) {
        console.warn("Password validation failed:", validationError);
      } else if (validation && !validation.valid) {
        setError(validation.errors.join(" "));
        setLoading(false);
        return;
      }

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
      if (signErr || !signData.user) throw signErr || new Error("Sign up failed");

      if (!signData.session) {
        const { error: siErr } = await supabase.auth.signInWithPassword({
          email: emailClean,
          password,
        });
        if (siErr) {
          setError(
            "Sign-up succeeded but no session. Please disable email confirmation in Supabase, or confirm your email.",
          );
          setLoading(false);
          return;
        }
      }

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

      router.replace("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-chessgrid relative min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
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

        <div className="surface-card p-7" style={{ boxShadow: "var(--shadow)" }}>
          <h1 className="text-xl font-semibold tracking-tight">
            Create an account
          </h1>
          <p className="mt-1 text-sm text-muted">
            Pick a unique handle. Letters and numbers only.
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="su-full"
                  className="mb-1.5 block text-xs font-medium"
                  style={{ color: "var(--text-2)" }}
                >
                  Full name
                </label>
                <input
                  id="su-full"
                  type="text"
                  className="input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  placeholder="Your full name"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="su-user"
                  className="mb-1.5 block text-xs font-medium"
                  style={{ color: "var(--text-2)" }}
                >
                  Username
                </label>
                <div className="relative">
                  <span
                    className="pointer-events-none absolute inset-y-0 left-0 grid w-7 place-items-center text-sm"
                    style={{ color: "var(--text-3)" }}
                  >
                    @
                  </span>
                  <input
                    id="su-user"
                    className="input"
                    style={{ paddingLeft: "1.75rem" }}
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
                {invalidAttempt && (
                  <p
                    className="mt-1 text-[11px]"
                    style={{ color: "var(--danger)" }}
                  >
                    Only letters and numbers allowed.
                  </p>
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="su-email"
                className="mb-1.5 block text-xs font-medium"
                style={{ color: "var(--text-2)" }}
              >
                Email
              </label>
              <input
                id="su-email"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label
                htmlFor="su-password"
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
                id="su-password"
                type={showPassword ? "text" : "password"}
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              {password.length > 0 && (
                <div className="mt-2">
                  <div
                    className="h-1 w-full overflow-hidden rounded-full"
                    style={{ background: "var(--surface-2)" }}
                  >
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${strength.pct}%`,
                        background: strength.color,
                      }}
                    />
                  </div>
                  <div
                    className="mt-1 flex items-center justify-between text-[11px]"
                    style={{ color: "var(--text-3)" }}
                  >
                    <span>{strength.label}</span>
                    <span>8+ chars, mix upper, lower, number</span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="su-confirm"
                className="mb-1.5 block text-xs font-medium"
                style={{ color: "var(--text-2)" }}
              >
                Confirm password
              </label>
              <input
                id="su-confirm"
                type={showPassword ? "text" : "password"}
                className="input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
                style={{
                  borderColor:
                    confirm.length > 0 && !passwordsMatch
                      ? "color-mix(in oklch, var(--danger) 55%, transparent)"
                      : undefined,
                }}
              />
              {confirm.length > 0 && !passwordsMatch && (
                <p
                  className="mt-1 text-[11px]"
                  style={{ color: "var(--danger)" }}
                >
                  Passwords don&apos;t match.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-accent inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm"
            >
              {loading ? (
                "Creating account…"
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Create account
                </>
              )}
            </button>
          </form>

          {suggestions.length > 0 && (
            <div className="mt-5">
              <div
                className="mb-2 text-[11px] font-medium uppercase tracking-wider"
                style={{ color: "var(--text-3)" }}
              >
                Try one of these
              </div>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setUsername(s)}
                    className="rounded-md px-2.5 py-1 text-xs transition-colors"
                    style={{
                      background: "var(--surface-1)",
                      color: "var(--text-2)",
                      border: "1px solid var(--border-strong)",
                    }}
                  >
                    @{s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <p
          className="mt-6 text-center text-sm"
          style={{ color: "var(--text-3)" }}
        >
          Already have an account?{" "}
          <Link
            href="/auth/signin"
            className="font-medium underline-offset-4 hover:underline"
            style={{ color: "var(--text)" }}
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

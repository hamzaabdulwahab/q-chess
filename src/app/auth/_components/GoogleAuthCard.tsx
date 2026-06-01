"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { getSafeAuthRedirect } from "@/lib/auth-redirect";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type AuthMode = "signin" | "signup";

type GoogleAuthCardProps = {
  mode: AuthMode;
};

const copyByMode = {
  signin: {
    title: "Welcome back",
    body: "Use your Google account to resume your games.",
    button: "Continue with Google",
    loading: "Opening Google...",
    footer: "New to Q-chess?",
    footerLink: "Create an account",
    footerHref: "/auth/signup",
  },
  signup: {
    title: "Create an account",
    body: "Create your Q-chess profile with Google.",
    button: "Sign up with Google",
    loading: "Opening Google...",
    footer: "Already have an account?",
    footerLink: "Sign in",
    footerHref: "/auth/signin",
  },
};

function getRedirectTo() {
  if (typeof window === "undefined") return "/";
  const url = new URL(window.location.href);
  return getSafeAuthRedirect(url.searchParams.get("redirectTo"));
}

function getCallbackUrl() {
  const callbackUrl = new URL("/auth/callback", window.location.origin);
  const redirectTo = getRedirectTo();
  if (redirectTo !== "/") callbackUrl.searchParams.set("redirectTo", redirectTo);
  return callbackUrl.toString();
}

function GoogleMark() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 shrink-0"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function GoogleAuthCard({ mode }: GoogleAuthCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = copyByMode[mode];

  const startGoogleAuth = async () => {
    setError(null);
    setLoading(true);

    try {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("last_email");
        window.localStorage.removeItem("remember_me");
      }

      const supabase = getSupabaseBrowser();
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: getCallbackUrl(),
        },
      });

      if (signInError) throw signInError;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Google authentication failed";
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div className="bg-chessgrid relative min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center justify-center gap-1.5">
          <BrandLogo size="lg" />
          <span
            className="text-2xl font-semibold tracking-tight"
            style={{ color: "var(--text)" }}
          >
            Q-Chess
          </span>
        </div>

        <div className="surface-card p-7" style={{ boxShadow: "var(--shadow)" }}>
          <h1 className="text-xl font-semibold tracking-tight">{copy.title}</h1>
          <p className="mt-1 text-sm text-muted">{copy.body}</p>

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

          <button
            type="button"
            disabled={loading}
            onClick={startGoogleAuth}
            className="btn-accent mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm"
          >
            {loading ? (
              copy.loading
            ) : (
              <>
                <GoogleMark />
                <span>{copy.button}</span>
              </>
            )}
          </button>
        </div>

        <p
          className="mt-6 text-center text-sm"
          style={{ color: "var(--text-3)" }}
        >
          {copy.footer}{" "}
          <Link
            href={copy.footerHref}
            className="font-medium underline-offset-4 hover:underline"
            style={{ color: "var(--text)" }}
          >
            {copy.footerLink}
          </Link>
        </p>
      </div>
    </div>
  );
}

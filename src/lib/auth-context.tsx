"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

// localStorage keys that hold auth-adjacent state. Cleared on sign-out so a
// fresh sign-in on the same device never inherits a previous user's hints.
const AUTH_LOCAL_KEYS = ["last_username", "last_email", "remember_me"] as const;

const AUTH_ROUTES = ["/auth/signin", "/auth/signup"];

function clearAuthLocalStorage(): void {
  if (typeof window === "undefined") return;
  for (const key of AUTH_LOCAL_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Private-mode / storage-disabled browsers: nothing to clear.
    }
  }
}

/**
 * The single, canonical sign-out path for the whole app. Revokes the session,
 * clears auth-adjacent local state, and performs a HARD navigation so every
 * in-memory Supabase subscription and Realtime channel is torn down and the
 * destination re-evaluates auth from scratch. Use this everywhere instead of
 * calling supabase.auth.signOut() ad hoc.
 */
export async function signOutAndRedirect(
  redirectTo = "/auth/signin",
): Promise<void> {
  const supabase = getSupabaseBrowser();
  try {
    await supabase.auth.signOut();
  } catch {
    // Even if the network sign-out fails, fall through and clear local state so
    // the user is not left in a half-authenticated UI.
  }
  clearAuthLocalStorage();
  if (typeof window !== "undefined") {
    window.location.href = redirectTo;
  }
}

type AuthContextValue = {
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

/**
 * Mounts exactly one onAuthStateChange subscription for the entire tab. This
 * gives the UI reactive, cross-tab/cross-device auth state (supabase-js syncs
 * the session across tabs via storage; this listener makes React react to it),
 * replacing the previous pattern where every page independently called
 * getUser() and AuthHydrator force-signed-out on any transient null.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Read the live pathname inside the (once-only) auth listener without making
  // the subscription itself depend on navigation.
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    let active = true;

    // Conservative server validation: only force a local sign-out when the
    // server DEFINITIVELY rejects the session (401/403 — user deleted or token
    // invalid), never on a bare null-with-no-error which can occur during a
    // refresh-token rotation window. This removes the spurious logouts that
    // made valid sessions feel like they were "dropping".
    supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          const status = (error as { status?: number }).status;
          if (status === 401 || status === 403) {
            clearAuthLocalStorage();
            void supabase.auth.signOut();
            setUser(null);
          }
        } else {
          setUser(data.user ?? null);
        }
        setLoading(false);
      })
      .catch(() => {
        // Network/refresh jitter must not log out a valid browser session;
        // protected server routes still re-validate before returning data.
        if (active) setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setLoading(false);
      if (event === "SIGNED_OUT") {
        clearAuthLocalStorage();
        // A sign-out from any tab/device lands here; bounce protected views to
        // sign-in. Stay put if we are already on an auth route.
        const onAuthRoute = AUTH_ROUTES.some((r) =>
          pathnameRef.current.startsWith(r),
        );
        if (!onAuthRoute) {
          router.replace("/auth/signin");
        }
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

"use client";
import { useEffect } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

// Ensures client-side session is cleared if the backend user no longer exists.
export function AuthHydrator() {
  useEffect(() => {
    const run = async () => {
      const supabase = getSupabaseBrowser();
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!error && !data.user) {
          await supabase.auth.signOut();
          try {
            window.localStorage.removeItem("last_username");
          } catch {}
        }
      } catch {
        // Network or refresh jitter should not force-log out a valid browser
        // session. Server routes still validate auth before protected data.
      }
    };
    run();
  }, []);
  return null;
}

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
        if (error || !data.user) {
          // Clear any persisted session remnants
          await supabase.auth.signOut();
          try {
            // Best-effort clean up of flags we set
            window.localStorage.removeItem("last_username");
          } catch {}
        }
      } catch {
        // On unexpected errors, also sign out to avoid phantom login state
        try {
          await getSupabaseBrowser().auth.signOut();
        } catch {}
      }
    };
    run();
  }, []);
  return null;
}

import { createBrowserClient } from "@supabase/ssr";

export function getSupabaseBrowser() {
  // Persist session based on a user preference stored in localStorage.
  // Default to true if not set.
  let persist = true;
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem("remember_me");
    persist = stored == null ? true : stored === "1";
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: persist,
      },
    }
  );
}

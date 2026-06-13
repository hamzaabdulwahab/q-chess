import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Singleton client. createBrowserClient does NOT internally cache, so calling
// it from every component spawns a fresh client and (more importantly) a
// fresh Realtime WebSocket connection. That breaks multi-component pages
// where one component sends on a channel and another listens — they end up
// on different sockets. Cache the instance for the lifetime of the tab.
let cached: SupabaseClient | undefined;

export function getSupabaseBrowser(): SupabaseClient {
  if (cached) return cached;

  cached = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    },
  );

  return cached;
}

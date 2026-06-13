import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  type SupabaseCookieToSet,
  withAuthCookieDefaults,
} from "@/lib/supabase-cookies";

// Server-side Supabase client using cookies for auth in Next.js App Router
export function getSupabaseServer() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async getAll() {
          const store = await cookies();
          return store.getAll();
        },
        async setAll(cookiesToSet: SupabaseCookieToSet[]) {
          const store = await cookies();
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              store.set(name, value, withAuthCookieDefaults(options));
            });
          } catch {
            // Server Components cannot write cookies. Middleware refreshes the
            // session and writes the browser-visible cookies for those renders.
          }
        },
      },
      db: {
        schema: 'public',
      },
      auth: {
        // Optimize auth settings for performance
        autoRefreshToken: true,
        persistSession: true,
      },
    }
  );
}

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side Supabase client using cookies for auth in Next.js App Router
export function getSupabaseServer() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          const store = await cookies();
          return store.get(name)?.value;
        },
        async set(name: string, value: string, options: CookieOptions) {
          const store = await cookies();
          store.set({ name, value, ...options });
        },
        async remove(name: string, options: CookieOptions) {
          const store = await cookies();
          store.set({ name, value: "", ...options });
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

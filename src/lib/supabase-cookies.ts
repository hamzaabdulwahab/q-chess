import type { CookieOptions } from "@supabase/ssr";

export type SupabaseCookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

export function withAuthCookieDefaults(options: CookieOptions): CookieOptions {
  return {
    ...options,
    path: options.path ?? "/",
    sameSite: options.sameSite ?? "lax",
    secure: options.secure ?? process.env.NODE_ENV === "production",
  };
}

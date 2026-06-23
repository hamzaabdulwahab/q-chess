import type { CookieOptions } from "@supabase/ssr";

export type SupabaseCookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

export function withAuthCookieDefaults(options: CookieOptions): CookieOptions {
  const domain = process.env.AUTH_COOKIE_DOMAIN?.trim();
  return {
    // Spreading first preserves the maxAge/expires Supabase sets, so the
    // session survives a full browser quit (avoids mobile-Safari "logged out
    // next day" from session-only cookies).
    ...options,
    path: options.path ?? "/",
    sameSite: options.sameSite ?? "lax",
    secure: options.secure ?? process.env.NODE_ENV === "production",
    // MUST stay readable by JS: the browser Supabase client reads these cookies
    // to keep persistSession working. Security comes from server-side getUser()
    // re-validation, NOT from httpOnly. Never set httpOnly:true here.
    httpOnly: false,
    // Only set a domain when the deployment explicitly spans multiple hosts.
    ...(domain ? { domain } : {}),
  };
}

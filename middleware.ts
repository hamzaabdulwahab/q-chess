import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  type SupabaseCookieToSet,
  withAuthCookieDefaults,
} from "@/lib/supabase-cookies";

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hasSupabaseAuthCookie = req.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-"));
  const isAuthPage =
    pathname.startsWith("/auth/signin") || pathname.startsWith("/auth/signup");
  const isProtected =
    pathname === "/" ||
    pathname.startsWith("/board") ||
    pathname.startsWith("/profile");

  // Only skip the Supabase round-trip for truly public, cookie-less requests.
  // Protected and auth routes ALWAYS validate through getUser() below, so route
  // protection never depends on a fragile cookie-name heuristic — a stale or
  // orphaned "sb-" cookie can no longer misfire the gate, and a future cookie
  // naming change cannot silently disable protection. Public routes that still
  // carry an auth cookie are refreshed so token rotation propagates.
  if (!isProtected && !isAuthPage && !hasSupabaseAuthCookie) {
    return NextResponse.next({ request: req });
  }

  let supabaseResponse = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet: SupabaseCookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => {
            req.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set({
              name,
              value,
              ...withAuthCookieDefaults(options),
            });
          });
          supabaseResponse.headers.set("Cache-Control", "private, no-store");
        },
      },
    }
  );

  // Keep this call immediately after client creation. It validates and refreshes
  // the user session before any route protection decisions are made.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isProtected && !user) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth/signin";
    if (pathname !== "/") {
      url.searchParams.set("redirectTo", pathname + (search || ""));
    }
    const redirect = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirect.cookies.set(cookie);
    });
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  }

  if (isAuthPage && user) {
    const redirect = NextResponse.redirect(new URL("/", req.url));
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirect.cookies.set(cookie);
    });
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp3|wasm|js|css)$).*)",
  ],
};

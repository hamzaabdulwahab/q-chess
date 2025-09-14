import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = req.nextUrl;

  const isAuthPage =
    pathname.startsWith("/auth/signin") || pathname.startsWith("/auth/signup");
  const isProtected =
    pathname === "/" ||
    pathname.startsWith("/board") ||
    pathname.startsWith("/profile");

  if (isProtected && !user) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth/signin";
    if (pathname !== "/") {
      url.searchParams.set("redirectTo", pathname + (search || ""));
    }
    return NextResponse.redirect(url);
  }

  if (isAuthPage && user) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/", "/board/:path*", "/auth/:path*", "/profile/:path*"],
};

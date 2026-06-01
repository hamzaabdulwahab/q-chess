import { NextResponse } from "next/server";
import { getSafeAuthRedirect } from "@/lib/auth-redirect";
import { ensureProfileForUser } from "@/lib/ensure-profile";
import { getSupabaseServer } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const redirectTo = getSafeAuthRedirect(
    requestUrl.searchParams.get("redirectTo"),
  );

  if (!code) {
    return NextResponse.redirect(new URL("/auth/signin", requestUrl.origin));
  }

  const supabase = getSupabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const url = new URL("/auth/signin", requestUrl.origin);
    url.searchParams.set("error", error.message);
    return NextResponse.redirect(url);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    try {
      await ensureProfileForUser(supabase, user);
    } catch (error) {
      console.error("Unable to ensure profile during auth callback:", error);
    }
  }

  return NextResponse.redirect(new URL(redirectTo, requestUrl.origin));
}

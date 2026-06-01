import { NextResponse } from "next/server";
import { ensureProfileForUser } from "@/lib/ensure-profile";
import { getSupabaseServer } from "@/lib/supabase-server";

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "No session" }, { status: 401 });

    let desired: string | null = null;
    try {
      const body = await req
        .json()
        .catch(() => ({} as Record<string, unknown>));
      if (typeof body?.username === "string" && body.username)
        desired = body.username;
    } catch {}
    await ensureProfileForUser(supabase, user, desired);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message =
      typeof e === "object" && e && "message" in e
        ? String((e as { message: unknown }).message)
        : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

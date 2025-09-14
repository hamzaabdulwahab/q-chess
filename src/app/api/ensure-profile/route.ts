import { NextResponse } from "next/server";
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
    if (!desired) {
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      desired =
        (typeof meta.username === "string" && meta.username) ||
        user.email?.split("@")[0] ||
        "user";
    }

    const { data: prof, error: selErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (selErr)
      return NextResponse.json(
        { error: (selErr as { message: string }).message },
        { status: 500 }
      );
    if (prof) return NextResponse.json({ ok: true });

    // Try insert; if username collision, retry with random suffix a few times
    let ok = false;
    for (let i = 0; i < 5; i++) {
      const candidate =
        i === 0 ? desired : `${desired}${Math.floor(Math.random() * 10000)}`;
      const { error: insErr } = await supabase
        .from("profiles")
        .insert({ id: user.id, username: candidate });
      if (!insErr) {
        ok = true;
        break;
      }
      // If conflict on id, treat as success; if on username, retry
      const code = (insErr as unknown as { code?: string }).code;
      if (code === "23505") {
        continue;
      } else {
        return NextResponse.json(
          { error: (insErr as { message: string }).message },
          { status: 500 }
        );
      }
    }
    if (!ok)
      return NextResponse.json(
        { error: "Username already taken" },
        { status: 409 }
      );

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message =
      typeof e === "object" && e && "message" in e
        ? String((e as { message: unknown }).message)
        : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

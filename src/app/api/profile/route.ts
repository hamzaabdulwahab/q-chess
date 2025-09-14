import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export async function GET() {
  const supabase = getSupabaseServer();
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = userRes.user.id;

  // Load profile row and build response
  const { data: prof, error: pErr } = await supabase
    .from("profiles")
    .select("username, full_name, avatar_url")
    .eq("id", uid)
    .single();
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });

  type Meta = { full_name?: string; username?: string };
  const meta = (userRes.user.user_metadata || {}) as Meta;
  return NextResponse.json({
    id: uid,
    email: userRes.user.email,
    full_name: prof?.full_name ?? meta.full_name ?? null,
    username: prof?.username ?? meta.username ?? null,
    avatar_url: prof?.avatar_url ?? null,
  });
}

export async function PATCH(req: Request) {
  const supabase = getSupabaseServer();
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = userRes.user.id;
  const body = await req.json().catch(() => ({}));

  const updates: { full_name?: string } = {};
  if (typeof body.full_name === "string") {
    const full = body.full_name.trim();
    if (!full)
      return NextResponse.json(
        { error: "Full name required" },
        { status: 400 }
      );
    updates.full_name = full;
  }

  if (updates.full_name) {
    // Update auth metadata and profiles table
    const { error: umErr } = await supabase.auth.updateUser({
      data: { full_name: updates.full_name },
    });
    if (umErr)
      return NextResponse.json({ error: umErr.message }, { status: 400 });

    const { error: upErr } = await supabase
      .from("profiles")
      .update({ full_name: updates.full_name })
      .eq("id", uid);
    if (upErr)
      return NextResponse.json({ error: upErr.message }, { status: 400 });
  }

  if (body.password) {
    const pw: string = String(body.password);
    if (pw.length < 8)
      return NextResponse.json(
        { error: "Password too short" },
        { status: 400 }
      );
    // Change password via auth API
    const { error: pwErr } = await supabase.auth.updateUser({ password: pw });
    if (pwErr)
      return NextResponse.json({ error: pwErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

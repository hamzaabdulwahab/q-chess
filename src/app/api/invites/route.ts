import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

// Helpers
function fiveMinutesFromNow() {
  return new Date(Date.now() + 5 * 60 * 1000).toISOString();
}

export async function GET() {
  const supabase = getSupabaseServer();
  const {
    data: { user },
    error: uerr,
  } = await supabase.auth.getUser();
  if (uerr || !user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("invites")
    .select("*")
    .eq("to_user", user.id)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invites: data || [] });
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseServer();
  const {
    data: { user },
    error: uerr,
  } = await supabase.auth.getUser();
  if (uerr || !user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { username } = await req.json().catch(() => ({}));
  if (!username)
    return NextResponse.json({ error: "username required" }, { status: 400 });

  // Find recipient by username in profiles
  const { data: profile, error: perr } = await supabase
    .from("profiles")
    .select("id, username")
    .ilike("username", username)
    .maybeSingle();
  if (perr) return NextResponse.json({ error: perr.message }, { status: 500 });
  if (!profile)
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (profile.id === user.id)
    return NextResponse.json(
      { error: "Cannot invite yourself" },
      { status: 400 }
    );

  const roomId = Math.random().toString(36).slice(2, 10);
  const expires = fiveMinutesFromNow();

  const { data, error } = await supabase
    .from("invites")
    .insert({
      from_user: user.id,
      to_user: profile.id,
      room_id: roomId,
      expires_at: expires,
    })
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invite: data });
}

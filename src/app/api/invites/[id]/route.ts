import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
    .eq("id", id)
    .maybeSingle();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ invite: data });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseServer();
  const {
    data: { user },
    error: uerr,
  } = await supabase.auth.getUser();
  if (uerr || !user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action } = await req.json().catch(() => ({}));
  if (!action || !["accepted", "declined"].includes(action))
    return NextResponse.json(
      { error: "action must be accepted or declined" },
      { status: 400 }
    );

  // Fetch invite to check expiry (RLS will allow if user is party)
  const { data: invite, error: ierr } = await supabase
    .from("invites")
    .select("*")
    .eq("id", id)
    .single();
  if (ierr) return NextResponse.json({ error: ierr.message }, { status: 404 });

  if (invite.status !== "pending")
    return NextResponse.json(
      { error: "Invite already processed" },
      { status: 400 }
    );
  if (new Date(invite.expires_at).getTime() < Date.now())
    return NextResponse.json({ error: "Invite expired" }, { status: 410 });

  const patch: Record<string, string> = { status: action };
  if (action === "accepted") patch.accepted_at = new Date().toISOString();
  if (action === "declined") patch.declined_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("invites")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invite: data });
}

// Optional: allow sender to cancel a pending invite they created
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseServer();
  const {
    data: { user },
    error: uerr,
  } = await supabase.auth.getUser();
  if (uerr || !user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only allow delete if I'm the sender and still pending
  const { data: inv, error: ierr } = await supabase
    .from("invites")
    .select("*")
    .eq("id", id)
    .single();
  if (ierr) return NextResponse.json({ error: ierr.message }, { status: 404 });
  if (inv.from_user !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (inv.status !== "pending")
    return NextResponse.json(
      { error: "Only pending invites can be canceled" },
      { status: 400 }
    );
  const { error } = await supabase.from("invites").delete().eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

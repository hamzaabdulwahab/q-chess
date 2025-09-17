import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export async function POST(req: Request) {
  const supabase = getSupabaseServer();
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = userRes.user.id;

  const form = await req.formData();
  const entry = form.get("file");
  if (!(entry instanceof Blob)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  const file = entry as File;
  // Enforce 10MB max on server
  if (file.size && file.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Image too large. Max 10MB allowed." },
      { status: 413 }
    );
  }
  const ext = (file.name || "").split(".").pop()?.toLowerCase() || "jpg";
  const path = `${uid}/avatar.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, file, {
      upsert: true,
      contentType: file.type || undefined,
    });
  if (upErr)
    return NextResponse.json({ error: upErr.message }, { status: 400 });

  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
  const publicUrl = pub?.publicUrl ?? null;

  // Persist URL on profile
  const { error: pErr } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", uid);
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });

  return NextResponse.json({ url: publicUrl });
}

export async function DELETE() {
  const supabase = getSupabaseServer();
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const uid = userRes.user.id;

  // Try to remove any existing avatar files for this user (best effort)
  // We don't know the extension, so list the folder and remove its contents.
  const { data: list, error: listErr } = await supabase.storage
    .from("avatars")
    .list(uid + "/");
  if (!listErr && list && list.length) {
    const paths = list.map((f) => `${uid}/${f.name}`);
    await supabase.storage.from("avatars").remove(paths);
  }

  // Clear avatar_url in profiles
  const { error: pErr } = await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", uid);
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

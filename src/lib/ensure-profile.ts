import type { SupabaseClient, User } from "@supabase/supabase-js";

export async function ensureProfileForUser(
  supabase: SupabaseClient,
  user: User,
  desiredUsername?: string | null,
) {
  let desired = desiredUsername?.trim() || null;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const avatarUrl =
    (typeof meta.avatar_url === "string" && meta.avatar_url.trim()) ||
    (typeof meta.picture === "string" && meta.picture.trim()) ||
    null;
  const fullName =
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    null;

  if (!desired) {
    desired =
      (typeof meta.username === "string" && meta.username.trim()) ||
      user.email?.split("@")[0] ||
      "user";
  }

  const { data: prof, error: selErr } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (selErr) throw selErr;
  if (prof) {
    const updates: { full_name?: string; avatar_url?: string } = {};
    if (!prof.full_name && fullName) updates.full_name = fullName;
    if (!prof.avatar_url && avatarUrl) updates.avatar_url = avatarUrl;
    if (Object.keys(updates).length > 0) {
      const { error: upErr } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);
      if (upErr) throw upErr;
    }
    return;
  }

  // Atomic create. The auth callback route and the client (AuthProvider /
  // ensure-profile API) can race to create the same profile on first sign-in;
  // upsert with onConflict:"id" + ignoreDuplicates turns an id collision into a
  // no-op instead of churning usernames and falsely throwing "Username already
  // taken". A genuine username collision (a DIFFERENT id) still surfaces as
  // 23505 and falls through to the suffix retry below.
  const { error: upsertErr } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      username: desired,
      full_name: fullName,
      avatar_url: avatarUrl,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );

  if (!upsertErr) return;
  if ((upsertErr as { code?: string }).code !== "23505") throw upsertErr;

  for (let i = 0; i < 5; i++) {
    const candidate = `${desired}${Math.floor(Math.random() * 10000)}`;
    const { error: insErr } = await supabase.from("profiles").insert({
      id: user.id,
      username: candidate,
      full_name: fullName,
      avatar_url: avatarUrl,
    });

    if (!insErr) return;
    if ((insErr as { code?: string }).code !== "23505") throw insErr;
  }

  throw new Error("Username already taken");
}

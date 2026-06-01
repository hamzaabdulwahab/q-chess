import type { SupabaseClient, User } from "@supabase/supabase-js";

export async function ensureProfileForUser(
  supabase: SupabaseClient,
  user: User,
  desiredUsername?: string | null,
) {
  let desired = desiredUsername?.trim() || null;

  if (!desired) {
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    desired =
      (typeof meta.username === "string" && meta.username.trim()) ||
      user.email?.split("@")[0] ||
      "user";
  }

  const { data: prof, error: selErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (selErr) throw selErr;
  if (prof) return;

  for (let i = 0; i < 5; i++) {
    const candidate =
      i === 0 ? desired : `${desired}${Math.floor(Math.random() * 10000)}`;
    const { error: insErr } = await supabase
      .from("profiles")
      .insert({ id: user.id, username: candidate });

    if (!insErr) return;
    if ((insErr as { code?: string }).code !== "23505") throw insErr;
  }

  throw new Error("Username already taken");
}

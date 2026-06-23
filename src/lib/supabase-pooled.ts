import { createClient } from "@supabase/supabase-js";

// Service-role Supabase client for server-side, RLS-bypassing operations
// (maintenance sweeps, and list reads that apply their own participant filter
// for security). Falls back to the anon key when no service-role key is set.
//
// NOTE: despite the "pooled" name this is a standard supabase-js / PostgREST
// HTTP client, NOT a direct Postgres connection pool. Connection pooling is
// handled server-side by Supabase/PostgREST; there is no 6543 transaction
// pooler wired up. Keep all usage server-side only — never import in client
// code, since it can carry the service-role key.
export function getSupabasePooledClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createClient(supabaseUrl, serviceKey, {
    db: {
      schema: "public",
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

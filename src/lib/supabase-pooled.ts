import { createClient } from '@supabase/supabase-js'

// Pooled database client for direct database operations
export function getSupabasePooledClient() {
  // Always use the regular HTTPS URL for Supabase client
  // The pooling is handled by the Supabase infrastructure based on your dashboard settings
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
  return createClient(supabaseUrl, serviceKey, {
    db: {
      schema: 'public',
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// Direct PostgreSQL connection string (for future use with raw SQL if needed)
export function getPooledConnectionString(): string {
  return process.env.SUPABASE_POOLED_URL || ''
}
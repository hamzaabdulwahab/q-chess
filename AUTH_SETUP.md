# Supabase Auth Setup

Use the SQL file at `scripts/supabase_auth.sql` in the Supabase SQL editor. It’s idempotent and avoids policy creation errors.

Steps:

- Open Supabase Dashboard → SQL Editor
- Paste the contents of `scripts/supabase_auth.sql`
- Run

Notes:

- The script drops and recreates policies to prevent “policy already exists” errors.
- Username is unique and restricted by the app to alphanumeric only.
- Public can read games/moves; only authenticated users can write.

Environment variables:

- NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY: required.
- SUPABASE_SERVICE_ROLE_KEY: required for username→email resolution used by username sign-in and magic links.
  - Find it in Supabase Dashboard → Project Settings → API → Service role.
  - Add it to `.env.local` (server-side only usage in API routes).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    console.log("Environment check:", {
      hasUrl: !!url,
      hasService: !!service,
      url: url ? `${url.substring(0, 30)}...` : 'undefined'
    });
    
    if (!url || !service) {
      console.error("Missing environment variables:", { url: !!url, service: !!service });
      return NextResponse.json(
        { error: "username_lookup_unavailable" },
        { status: 503 }
      );
    }
    const { username } = (await req.json().catch(() => ({}))) as {
      username?: string;
    };
    if (!username)
      return NextResponse.json({ error: "username required" }, { status: 400 });

    const admin = createClient(url, service, {
      auth: { persistSession: false },
    });
    // Find profile by username
    const { data: profiles, error: pErr } = await admin
      .from("profiles")
      .select("id")
      .eq("username", username)
      .limit(1);
    if (pErr)
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    if (!profiles || profiles.length === 0)
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    const id = profiles[0].id as string;

    // Get auth user to read email
    const { data: userRes, error: uErr } = await admin.auth.admin.getUserById(
      id
    );
    if (uErr)
      return NextResponse.json({ error: uErr.message }, { status: 500 });
    const email = userRes.user?.email;
    if (!email)
      return NextResponse.json({ error: "email_missing" }, { status: 404 });

    return NextResponse.json({ email });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

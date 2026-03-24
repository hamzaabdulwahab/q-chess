import { NextRequest, NextResponse } from "next/server";
import { getSupabasePooledClient } from "@/lib/supabase-pooled";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get("authorization") || "";
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabasePooledClient();
    const { error } = await supabase.from("profiles").select("id").limit(1);

    if (error) {
      console.error("[cron][keep-alive] Supabase ping failed:", error.message);
      return NextResponse.json(
        { ok: false, error: "Supabase ping failed" },
        { status: 500 }
      );
    }

    console.info("[cron][keep-alive] Supabase ping succeeded");
    return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[cron][keep-alive] Unexpected failure:", message);
    return NextResponse.json(
      { ok: false, error: "Unexpected keep-alive failure" },
      { status: 500 }
    );
  }
}

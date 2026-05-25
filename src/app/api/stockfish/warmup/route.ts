import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { warmStockfishEngine } from "@/lib/stockfish/engine";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST() {
  const supabase = getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await warmStockfishEngine();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[stockfish warmup]", error);
    return NextResponse.json(
      { error: "Stockfish warmup failed" },
      { status: 500 },
    );
  }
}

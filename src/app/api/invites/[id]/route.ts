import { NextRequest, NextResponse } from "next/server";
import { ChessService } from "@/lib/chess-service";
import { getSupabaseServer } from "@/lib/supabase-server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const inviteId = Number(id);
    if (!Number.isFinite(inviteId) || inviteId <= 0) {
      return NextResponse.json({ error: "Invalid invite ID" }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const action = String(body.action || "").toLowerCase();
    if (action !== "accept" && action !== "decline") {
      return NextResponse.json(
        { error: "Action must be accept or decline" },
        { status: 400 }
      );
    }

    const result = await ChessService.respondToInvite(
      inviteId,
      user.id,
      action as "accept" | "decline"
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to respond to invite";
    const status =
      message.includes("not found") ||
      message.includes("Only") ||
      message.includes("pending") ||
      message.includes("expired")
        ? 400
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const inviteId = Number(id);
    if (!Number.isFinite(inviteId) || inviteId <= 0) {
      return NextResponse.json({ error: "Invalid invite ID" }, { status: 400 });
    }

    await ChessService.cancelInvite(inviteId, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to cancel invite";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

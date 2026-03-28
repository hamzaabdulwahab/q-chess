import { NextRequest, NextResponse } from "next/server";
import { ChessService } from "@/lib/chess-service";
import { getSupabaseServer } from "@/lib/supabase-server";

type InviteDirection = "incoming" | "outgoing" | "all";

function parseTimeControl(body: Record<string, unknown>) {
  const minutes = Number(body.timeControlMinutes ?? 10);
  const incrementSeconds = Number(body.incrementSeconds ?? 0);

  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 30) {
    throw new Error("Time control minutes must be between 1 and 30");
  }
  if (
    !Number.isFinite(incrementSeconds) ||
    incrementSeconds < 0 ||
    incrementSeconds > 30
  ) {
    throw new Error("Increment must be between 0 and 30 seconds");
  }

  return {
    timeControlInitialMs: Math.floor(minutes * 60 * 1000),
    incrementMs: Math.floor(incrementSeconds * 1000),
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const directionParam =
      new URL(request.url).searchParams.get("direction") || "all";
    const direction: InviteDirection =
      directionParam === "incoming" ||
      directionParam === "outgoing" ||
      directionParam === "all"
        ? directionParam
        : "all";

    const invites = await ChessService.getInvites(user.id, direction);
    return NextResponse.json({ invites });
  } catch (error) {
    console.error("Error fetching invites:", error);
    return NextResponse.json(
      { error: "Failed to fetch invites" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const username = String(body.username || "").trim();

    if (!username) {
      return NextResponse.json(
        { error: "Username is required" },
        { status: 400 }
      );
    }

    const { timeControlInitialMs, incrementMs } = parseTimeControl(body);

    const invite = await ChessService.createInvite(user.id, username, {
      timeControlInitialMs,
      incrementMs,
    });

    return NextResponse.json({
      success: true,
      inviteId: invite.id,
      toUserId: invite.toUserId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send invite";
    const status =
      message.includes("already exists") ||
      message.includes("not found") ||
      message.includes("cannot invite") ||
      message.includes("between")
        ? 400
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

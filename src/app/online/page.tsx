"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { WSClient } from "@/lib/ws-client";
import { ChessBoard } from "@/components/ChessBoard";
import { PlayerBadge } from "@/components/PlayerBadge";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

function randomId() {
  return Math.random().toString(36).slice(2, 8);
}

export default function Online() {
  const [roomId, setRoomId] = useState<string>("");
  const [gameId, setGameId] = useState<number | null>(null);
  const [color, setColor] = useState<"white" | "black" | null>(null);
  const [fen, setFen] = useState(
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
  );
  const [status, setStatus] = useState<string>(
    "Share the room link with your opponent."
  );
  // 25 minutes per player (1500000ms). Adjust below if you change total game time.
  const INITIAL_MS = 25 * 60 * 1000;
  const [whiteTimeMs, setWhiteTimeMs] = useState<number>(INITIAL_MS);
  const [blackTimeMs, setBlackTimeMs] = useState<number>(INITIAL_MS);
  const [gameOver, setGameOver] = useState<null | {
    winner: "white" | "black";
    reason: string;
  }>(null);
  const [started, setStarted] = useState<boolean>(false);
  const hydratedRef = useRef(false);
  const [me, setMe] = useState<{
    name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
  } | null>(null);
  const wsRef = useRef<WSClient | null>(null);
  const currentTurn: "white" | "black" = useMemo(
    () => (fen.includes(" w ") ? "white" : "black"),
    [fen]
  );

  // Clock ticking
  useEffect(() => {
    if (gameOver || !started) return; // stop when game ended or not started
    let raf: number;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      if (currentTurn === "white") {
        setWhiteTimeMs((t) => Math.max(0, t - dt));
      } else {
        setBlackTimeMs((t) => Math.max(0, t - dt));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [currentTurn, gameOver, started]);

  // Load current user's profile for badge
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, username, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        type ProfileData = {
          full_name?: string | null;
          username?: string | null;
          avatar_url?: string | null;
        };
        const p = data as ProfileData;
        setMe({
          name: p.full_name ?? null,
          username: p.username ?? null,
          avatar_url: p.avatar_url ?? null,
        });
      }
    })();
  }, []);

  // Timeout detection
  useEffect(() => {
    if (!gameOver && whiteTimeMs <= 0) {
      setGameOver({ winner: "black", reason: "White ran out of time" });
      setStatus("Game over: Black wins on time.");
      // notify peer
      wsRef.current?.timeout("black", "White ran out of time");
      // optional DB persistence if gid is present
      if (gameId) {
        fetch(`/api/games/${gameId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "timeout", winner: "black" }),
        }).catch(() => {});
      }
    }
  }, [whiteTimeMs, gameOver, gameId]);
  useEffect(() => {
    if (!gameOver && blackTimeMs <= 0) {
      setGameOver({ winner: "white", reason: "Black ran out of time" });
      setStatus("Game over: White wins on time.");
      wsRef.current?.timeout("white", "Black ran out of time");
      if (gameId) {
        fetch(`/api/games/${gameId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "timeout", winner: "white" }),
        }).catch(() => {});
      }
    }
  }, [blackTimeMs, gameOver, gameId]);

  // Build a sharable URL with room param
  const shareUrl =
    typeof window !== "undefined" && roomId
      ? `${window.location.origin}/online?room=${roomId}${
          gameId ? `&gid=${gameId}` : ""
        }`
      : "";

  useEffect(() => {
    const url = new URL(window.location.href);
    let room = url.searchParams.get("room") || "";
    const gid = url.searchParams.get("gid");
    if (!room) {
      room = randomId();
      // update URL so it can be shared
      const newQuery = gid ? `room=${room}&gid=${gid}` : `room=${room}`;
      window.history.replaceState({}, "", `/online?${newQuery}`);
    }
    setRoomId(room);
    if (gid && /^\d+$/.test(gid)) setGameId(parseInt(gid));

    const client = new WSClient();
    wsRef.current = client;
    client.connect({
      onOpen: () => {
        /* connected */
      },
      onJoined: (p) => {
        setColor(p.color);
        setFen(p.fen);
        setStatus("Waiting for opponent...");
      },
      onReady: (p) => {
        setStatus("Opponent connected. Your game is live.");
        setFen(p.fen);
      },
      onMoved: (p) => {
        setFen(p.fen);
        // Persist every move to DB if gid is present
        if (gameId) {
          fetch(`/api/games/${gameId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              from: p.from,
              to: p.to,
              promotion: p.promotion,
            }),
          }).catch(() => {});
        }
      },
      onSynced: (p) => setFen(p.fen),
      onOpponentLeft: () => setStatus("Opponent left the game."),
      onTimeout: ({ winner, reason }) => {
        setGameOver({ winner, reason: reason || `${winner} wins on time` });
        setStatus(`Game over: ${winner} wins on time.`);
        if (gameId) {
          fetch(`/api/games/${gameId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "timeout", winner }),
          }).catch(() => {});
        }
      },
      onError: (e) => setStatus(`Error: ${e.error}`),
      onClose: () => {
        /* disconnected */
      },
    });

    // join with current fen so host can seed
    const initialFen = fen;
    const t = setTimeout(() => client.join(room, initialFen), 50);

    return () => {
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist clocks by room and my color
  const storageKey = useMemo(() => {
    const r = roomId || "room";
    const col = color || "unknown";
    return `online-clock-${r}-${col}`;
  }, [roomId, color]);

  // Hydrate once when we know color (after join)
  useEffect(() => {
    if (!color || hydratedRef.current) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        hydratedRef.current = true;
        return;
      }
      const saved = JSON.parse(raw) as {
        mine: number;
        theirs: number;
        started: boolean;
        currentTurn: "white" | "black";
        savedAt: number;
      };
      let my = saved.mine;
      let opp = saved.theirs;
      if (saved.started && !gameOver) {
        const elapsed = Date.now() - (saved.savedAt || Date.now());
        if (elapsed > 0) {
          if (saved.currentTurn === currentTurn) {
            if (currentTurn === color) my = Math.max(0, my - elapsed);
            else opp = Math.max(0, opp - elapsed);
          }
        }
      }
      if (color === "white") {
        setWhiteTimeMs(my);
        setBlackTimeMs(opp);
      } else if (color === "black") {
        setWhiteTimeMs(opp);
        setBlackTimeMs(my);
      }
      setStarted((prev) => prev || saved.started);
      hydratedRef.current = true;
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color, currentTurn]);

  // Save clocks whenever they change
  useEffect(() => {
    if (!color) return;
    try {
      const my = color === "white" ? whiteTimeMs : blackTimeMs;
      const opp = color === "white" ? blackTimeMs : whiteTimeMs;
      const payload = {
        mine: my,
        theirs: opp,
        started,
        currentTurn,
        savedAt: Date.now(),
      };
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {}
  }, [whiteTimeMs, blackTimeMs, started, currentTurn, color, storageKey]);

  const handleMove = (result: {
    success: boolean;
    fen: string;
    gameStatus?: string;
    move?: string;
    from?: string;
    to?: string;
    promotion?: string;
  }) => {
    if (!result.success) return;
    if (gameOver) return; // block moves after game over
    if (!started) setStarted(true);
    setFen(result.fen);
    if (result.gameStatus && result.gameStatus !== "active") {
      // Derive winner best-effort (server broadcasts timeout separately)
      const winner =
        result.gameStatus === "checkmate"
          ? currentTurn === "white"
            ? "black"
            : "white"
          : undefined;
      setGameOver(
        winner
          ? { winner, reason: "Checkmate" }
          : { winner: currentTurn, reason: result.gameStatus }
      );
    }
    if (result.from && result.to) {
      // send minimal move event; server will validate and broadcast
      wsRef.current?.move(result.from, result.to, result.promotion);
    } else {
      wsRef.current?.sync(result.fen);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm text-accent">
            Room: <span className="font-mono text-accent">{roomId}</span>
            {color && (
              <span className="ml-3">
                You are <span className="font-bold">{color}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={shareUrl}
              className="w-[300px] bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs"
            />
            <button
              onClick={() =>
                shareUrl && navigator.clipboard.writeText(shareUrl)
              }
              className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
            >
              Copy Link
            </button>
          </div>
        </div>
        <div className="text-accent text-sm mb-6">{status}</div>

        <div className="flex justify-center">
          <div
            className="flex flex-col items-stretch gap-2"
            style={{ width: 864 }}
          >
            <div className="flex justify-start">
              <PlayerBadge
                name={
                  me?.name ||
                  (color ? `${color[0].toUpperCase()}${color.slice(1)}` : "Me")
                }
                username={me?.username || undefined}
                avatarUrl={me?.avatar_url || undefined}
                timeMs={color === "white" ? whiteTimeMs : blackTimeMs}
                active={currentTurn === (color || "white")}
                align="top-left"
                color={color || undefined}
                absolute={false}
              />
            </div>
            <ChessBoard
              fen={fen}
              onMove={handleMove}
              disabled={gameOver ? true : color ? color !== currentTurn : true}
              orientation={color || "white"}
              turn={currentTurn}
            />
            <div className="flex justify-end">
              <PlayerBadge
                name={color === "white" ? "Black" : "White"}
                username={"opponent"}
                timeMs={color === "white" ? blackTimeMs : whiteTimeMs}
                active={currentTurn !== (color || "white")}
                align="bottom-right"
                color={color === "white" ? "black" : "white"}
                absolute={false}
              />
            </div>
          </div>
        </div>
        {gameOver && (
          <div className="text-accent mt-3 text-center">{gameOver.reason}</div>
        )}
      </div>
    </div>
  );
}

// Lightweight client for the chess WebSocket server

export type WSClientEvents = {
  onOpen?: () => void;
  onJoined?: (payload: {
    gameId: string;
    color: "white" | "black";
    fen: string;
  }) => void;
  onReady?: (payload: { gameId: string; fen: string }) => void;
  onMoved?: (payload: {
    from: string;
    to: string;
    promotion?: string;
    fen: string;
    san?: string;
  }) => void;
  onSynced?: (payload: { fen: string }) => void;
  onIllegal?: (payload: { from: string; to: string }) => void;
  onOpponentLeft?: () => void;
  onError?: (payload: { error: string }) => void;
  onTimeout?: (payload: { winner: "white" | "black"; reason?: string }) => void;
  onClose?: () => void;
};

export class WSClient {
  private ws?: WebSocket;
  private url: string;

  constructor(
    url = process.env.NEXT_PUBLIC_WS_URL ||
      (typeof window !== "undefined"
        ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${
            window.location.hostname
          }:${(process.env.NEXT_PUBLIC_WS_PORT as string) || "8080"}`
        : `ws://localhost:${process.env.NEXT_PUBLIC_WS_PORT || 8080}`)
  ) {
    this.url = url;
  }

  connect(events: WSClientEvents) {
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => events.onOpen?.();
    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        switch (msg.type) {
          case "joined":
            events.onJoined?.(msg);
            break;
          case "ready":
            events.onReady?.(msg);
            break;
          case "moved":
            events.onMoved?.(msg);
            break;
          case "synced":
            events.onSynced?.(msg);
            break;
          case "illegal":
            events.onIllegal?.(msg);
            break;
          case "opponent_left":
            events.onOpponentLeft?.();
            break;
          case "error":
            events.onError?.(msg);
            break;
          case "timeout":
            events.onTimeout?.(msg);
            break;
        }
      } catch {
        // ignore
      }
    };
    this.ws.onclose = () => events.onClose?.();
  }

  join(gameId: string, fen?: string) {
    this.ws?.send(JSON.stringify({ type: "join", gameId, fen }));
  }

  move(from: string, to: string, promotion?: string) {
    this.ws?.send(JSON.stringify({ type: "move", from, to, promotion }));
  }

  sync(fen: string) {
    this.ws?.send(JSON.stringify({ type: "sync", fen }));
  }

  timeout(winner: "white" | "black", reason?: string) {
    this.ws?.send(JSON.stringify({ type: "timeout", winner, reason }));
  }
}

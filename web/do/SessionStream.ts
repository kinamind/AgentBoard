// Durable Object: one instance per session id. It is the realtime bus that fans out
// status/log/event frames (pushed by the API layer) to all subscribed browsers, and
// keeps a small in-memory ring buffer so a freshly connected dashboard sees recent
// output immediately (REST provides the full history).

const BUFFER_CAP = 800;

export class SessionStream {
  private sockets = new Set<WebSocket>();
  private buffer: unknown[] = [];

  constructor(
    _state: DurableObjectState,
    _env: unknown,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.endsWith("/subscribe")) {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("expected websocket", { status: 426 });
      }
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      this.accept(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname.endsWith("/publish")) {
      const frame = await request.json().catch(() => null);
      if (frame) this.publish(frame);
      return new Response("ok");
    }

    return new Response("not found", { status: 404 });
  }

  private accept(ws: WebSocket) {
    ws.accept();
    this.sockets.add(ws);
    // Send buffered recent frames so the client catches up instantly.
    try {
      ws.send(JSON.stringify({ t: "backlog", frames: this.buffer }));
    } catch {
      /* ignore */
    }
    ws.addEventListener("close", () => this.sockets.delete(ws));
    ws.addEventListener("error", () => this.sockets.delete(ws));
  }

  private publish(frame: unknown) {
    // Keep log/status/event frames in the ring buffer (skip control frames).
    this.buffer.push(frame);
    if (this.buffer.length > BUFFER_CAP) {
      this.buffer.splice(0, this.buffer.length - BUFFER_CAP);
    }
    const payload = JSON.stringify(frame);
    for (const ws of this.sockets) {
      try {
        ws.send(payload);
      } catch {
        this.sockets.delete(ws);
      }
    }
  }
}

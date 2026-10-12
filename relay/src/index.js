// Room server for Changa Chait multiplayer (version 2.0), as a Cloudflare Worker.
// This is the feasibility prototype: it passes messages between the phones in a room.
//
// A phone joins a room with a WebSocket (a connection that stays open):
//   wss://nep-games-relay.akarmanya.workers.dev/room/<CODE>
// Each room code is one Durable Object, so all players in a room meet in one place.
// The room gives each phone a seat (0-4) and passes every message on to the
// other phones, with the sender's seat added.
//
// Messages from the room:
//   {"type": "welcome", "seat": 2, "players": [0, 1], "edge": "KTM", "room": "SIN"}
//   {"type": "join", "seat": 3}      {"type": "leave", "seat": 1}
//   {...the sender's message..., "seat": 0}
//
// It uses the WebSocket Hibernation API (ctx.acceptWebSocket), so Cloudflare
// does not bill run time while the room waits between messages.

import { DurableObject } from "cloudflare:workers";

const MAX_PLAYERS = 5;
const MAX_MESSAGE = 1024; // characters

// Each phone may send 30 messages a second on average, with bursts of up to
// 150 (a phone on a slow network can deliver several seconds of messages at once).
// A phone that sends more is disconnected, so one bad client cannot use up the
// free plan's daily allowance as fast.
const RATE = 30;
const BURST = 150;

// Sites that may join rooms. Browsers send the origin in lower case.
const ORIGINS = [
  "https://akarmanya-dev.github.io",
  "http://127.0.0.1:8011", // local test server
  "http://localhost:8011",
];

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // Message allowance for each socket. Kept in memory only: it resets when
    // the room hibernates, which is fine.
    this.tokens = new Map();
  }

  async fetch(request) {
    const sockets = this.ctx.getWebSockets();
    if (sockets.length >= MAX_PLAYERS) return new Response("room full", { status: 409 });
    const taken = sockets.map(ws => ws.deserializeAttachment().seat);
    let seat = 0;
    while (taken.includes(seat)) seat++;

    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ seat });
    server.send(JSON.stringify({
      type: "welcome", seat, players: taken,
      edge: request.headers.get("X-Edge") || "?", room: await this.location(),
    }));
    this.broadcast(server, { type: "join", seat });
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws, message) {
    if (!this.allow(ws) || typeof message !== "string" || message.length > MAX_MESSAGE) {
      ws.close(1008, "too many or too large messages");
      return;
    }
    let data;
    try { data = JSON.parse(message); } catch { return; }
    if (!data || typeof data !== "object" || Array.isArray(data)) return;
    data.seat = ws.deserializeAttachment().seat;
    this.broadcast(ws, data);
  }

  webSocketClose(ws) { this.leave(ws); }
  webSocketError(ws) { this.leave(ws); }

  leave(ws) {
    this.tokens.delete(ws);
    this.broadcast(ws, { type: "leave", seat: ws.deserializeAttachment().seat });
  }

  broadcast(from, data) {
    const text = JSON.stringify(data);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === from) continue;
      try { ws.send(text); } catch {}
    }
  }

  allow(ws) {
    const now = Date.now();
    const t = this.tokens.get(ws) || { left: BURST, at: now };
    t.left = Math.min(BURST, t.left + (now - t.at) * RATE / 1000) - 1;
    t.at = now;
    this.tokens.set(ws, t);
    return t.left >= 0;
  }

  // The code of the Cloudflare data center that runs this room, for the test page.
  async location() {
    if (!this.colo) {
      try {
        const trace = await (await fetch("https://www.cloudflare.com/cdn-cgi/trace")).text();
        this.colo = (trace.match(/^colo=(\w+)/m) || [])[1] || "?";
      } catch {
        this.colo = "?";
      }
    }
    return this.colo;
  }
}

export default {
  async fetch(request, env) {
    const match = new URL(request.url).pathname.match(/^\/room\/([A-Z0-9]{4,8})$/);
    if (!match) return new Response("not found", { status: 404 });
    if ((request.headers.get("Upgrade") || "").toLowerCase() !== "websocket") {
      return new Response("expected a WebSocket", { status: 426 });
    }
    if (!ORIGINS.includes(request.headers.get("Origin") || "")) {
      return new Response("origin not allowed", { status: 403 });
    }
    // Tell the room which data center the phone connected through.
    const headers = new Headers(request.headers);
    headers.set("X-Edge", request.cf?.colo || "?");
    const room = env.ROOMS.get(env.ROOMS.idFromName(match[1]));
    return room.fetch(new Request(request, { headers }));
  },
};

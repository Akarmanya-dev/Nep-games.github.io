// Visit counter for the Nep Games site, as a Cloudflare Worker.
// One Durable Object ("site") keeps the counts in its SQLite storage:
//   total        -- visits to the site (a visit can open several pages)
//   page:<slug>  -- visits that opened that page
//
// POST /hit     body {"page": "<slug>", "visit": true|false}  -> counts
// GET  /counts                                                -> counts
// counts = {"total": 123, "pages": {"home": 120, "kauda": 40, ...}}

import { DurableObject } from "cloudflare:workers";

// Only these pages are counted, so nobody can fill the storage with junk keys.
const PAGES = new Set([
  "home", "changa-chait", "chungi", "tuin", "dandi-biyo", "kauda", "jhanda-burja",
  "recharge-card", "morning-assembly",
]);

// Sites that may record visits. Browsers send the origin in lower case.
const ORIGINS = [
  "https://akarmanya-dev.github.io",
  "http://127.0.0.1:8011", // local test server
  "http://localhost:8011",
];

// Light guard against a script that inflates the count. Addresses stay in
// memory for one minute and are never stored.
const HITS_PER_MINUTE = 20;

export class Counter extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec("CREATE TABLE IF NOT EXISTS counts (key TEXT PRIMARY KEY, n INTEGER NOT NULL)");
    this.minute = 0;
    this.seen = new Map();
  }

  hit(page, visit, address) {
    if (this.allow(address)) {
      const add = key => this.sql.exec(
        "INSERT INTO counts (key, n) VALUES (?, 1) ON CONFLICT (key) DO UPDATE SET n = n + 1", key);
      add("page:" + page);
      if (visit) add("total");
    }
    return this.counts();
  }

  counts() {
    const out = { total: 0, pages: {} };
    for (const { key, n } of this.sql.exec("SELECT key, n FROM counts")) {
      if (key === "total") out.total = n;
      else out.pages[key.slice("page:".length)] = n;
    }
    return out;
  }

  allow(address) {
    const minute = Math.floor(Date.now() / 60000);
    if (minute !== this.minute) { this.minute = minute; this.seen.clear(); }
    const n = (this.seen.get(address) || 0) + 1;
    this.seen.set(address, n);
    return n <= HITS_PER_MINUTE;
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": ORIGINS.includes(origin) ? origin : ORIGINS[0],
      "Access-Control-Allow-Methods": "GET, POST",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };
    const reply = (body, status = 200) => new Response(JSON.stringify(body), {
      status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    const site = env.COUNTER.get(env.COUNTER.idFromName("site"));
    const { pathname } = new URL(request.url);

    if (pathname === "/counts" && request.method === "GET") return reply(await site.counts());

    if (pathname === "/hit" && request.method === "POST") {
      if (!ORIGINS.includes(origin)) return reply({ error: "origin not allowed" }, 403);
      let body;
      try { body = await request.json(); } catch { return reply({ error: "bad body" }, 400); }
      if (!PAGES.has(body.page)) return reply({ error: "unknown page" }, 400);
      const address = request.headers.get("CF-Connecting-IP") || "unknown";
      return reply(await site.hit(body.page, body.visit === true, address));
    }

    return reply({ error: "not found" }, 404);
  },
};

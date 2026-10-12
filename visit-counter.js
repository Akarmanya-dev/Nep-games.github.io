// Visit counter: tells our Cloudflare Worker (see visit-counter/) about each
// visit and shows the total on the menu. A visit ends after 30 minutes with
// no page opened, so reloads and going back to the menu count only once.
(() => {
  // The Worker's address, printed by "npx wrangler deploy". Empty = counter off.
  const API = "https://nep-games-visit-counter.akarmanya.workers.dev";
  const VISIT_GAP = 30 * 60 * 1000;
  if (!API) return;

  const match = location.pathname.match(/\/games\/([a-z-]+)\//);
  const page = match ? match[1] : "home";
  const badge = document.getElementById("visits");

  // Remember which pages this visit has already counted.
  let visit = true, counted = false;
  try {
    const now = Date.now();
    const last = JSON.parse(localStorage.getItem("nep.visit") || "null");
    if (last && now - last.t < VISIT_GAP) {
      counted = last.pages.includes(page);
      visit = false;
    }
    const pages = visit ? [page] : counted ? last.pages : [...last.pages, page];
    localStorage.setItem("nep.visit", JSON.stringify({ t: now, pages }));
  } catch (e) {}

  if (counted && !badge) return;
  const request = counted
    ? fetch(API + "/counts")
    : fetch(API + "/hit", { method: "POST", body: JSON.stringify({ page, visit }), keepalive: true });

  request
    .then(r => (r.ok ? r.json() : null))
    .then(counts => {
      if (!badge || !counts || !counts.total) return;
      badge.querySelector("b").textContent = counts.total.toLocaleString("en-US");
      badge.querySelector("span").textContent = counts.total === 1 ? "visit" : "visits";
      badge.hidden = false;
    })
    .catch(() => {});
})();

# Visit counter

A Cloudflare Worker that counts visits to the site. It runs on the Cloudflare
free plan. One Durable Object (a small storage unit that Cloudflare keeps
running) holds the counts.

- `src/index.js`: the Worker.
- `wrangler.jsonc`: the Cloudflare settings.
- `../visit-counter.js`: the script that each page loads. It sends one hit
  for each page in a visit and shows the total on the menu.

A visit ends after 30 minutes with no page opened. Ad blockers can block the
hits, so the real number of visits is a little higher.

## See the counts

Open https://nep-games-visit-counter.akarmanya.workers.dev/counts in a
browser. Example result:

```json
{"total": 120, "pages": {"home": 118, "kauda": 40, "tuin": 25}}
```

## Deploy

You need Node.js and a free Cloudflare account.

1. Create an API token at dash.cloudflare.com: My Profile, API Tokens,
   Create Token, template "Edit Cloudflare Workers".
2. Go to this folder: `cd visit-counter`
3. Deploy: `CLOUDFLARE_API_TOKEN=<token> npx wrangler deploy`
4. If Wrangler asks for a workers.dev subdomain, type a name, for example `nepgames`.
5. Copy the address that ends in `workers.dev`.
6. Put the address in `../visit-counter.js`, in the line `const API = "";`.

Do not put the token in a file. To change the Worker later, repeat step 3.

## Add a game

Add the game's folder name to `PAGES` in `src/index.js`, then deploy again.
Add `<script src="../../visit-counter.js" defer></script>` before `</body>`
in the game's `index.html`.

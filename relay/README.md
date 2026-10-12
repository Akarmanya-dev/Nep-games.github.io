# Changa Chait room server

A Cloudflare Worker for Changa Chait multiplayer (version 2.0). It runs on the
Cloudflare free plan. This is the feasibility prototype: it only passes
messages between the phones in a room. The game does not use it yet.

- `src/index.js`: the Worker. Each room code is one Durable Object (a small
  server that Cloudflare keeps running). A room holds up to 5 phones.
- `wrangler.jsonc`: the Cloudflare settings.
- `test.html`: a page that measures the delay between phones through the room.

## Free plan use

Cloudflare counts every 20 messages from phones as 1 request. Messages from the
room to the phones are free. Opening a connection is 1 request. The free plan
allows 100,000 requests a day, shared with the visit counter. A 5-player,
5-minute game at 10 updates a second uses about 750 requests.

## Deploy

1. Add Node.js to your shell's path:
   `export PATH=/uufs/sci.utah.edu/scratch/users/sandesh.pokhrel/node/bin:$PATH`
2. Keep npm's cache on scratch:
   `export npm_config_cache=/uufs/sci.utah.edu/scratch/users/sandesh.pokhrel/npm-cache`
3. Enter the Cloudflare API token: `read -s CLOUDFLARE_API_TOKEN`
4. Make the token available to Wrangler: `export CLOUDFLARE_API_TOKEN`
5. Go to this folder: `cd ~/Claude_Vibing/Nep-games/relay`
6. Deploy: `npx wrangler deploy`

The room server's address is https://nep-games-relay.akarmanya.workers.dev.

## Test

After you push this folder, open the test page on a phone:
https://akarmanya-dev.github.io/Nep-games.github.io/relay/test.html

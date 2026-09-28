# Nep-games

Small browser games about the moments every Nepali remembers. Built for phones: open the link and play,
no install.

**Play:** https://akarmanya-dev.github.io/Nep-games.github.io/

## Structure

```
index.html            game menu (the site's home page)
games/<slug>/         one folder per game, each with its own index.html
```

Each game is plain HTML + JavaScript and is self-contained in its folder, so every game also has its own
shareable link: `https://akarmanya-dev.github.io/Nep-games/games/<slug>/`

## Adding a game

1. Create `games/<slug>/index.html`.
2. Add an entry to the `GAMES` list in `index.html`.
3. Push to `main`. GitHub Pages redeploys automatically.

## Run locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

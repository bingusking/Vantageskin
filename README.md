# Vantage Cases

A companion to [Vantage](https://github.com/sonion548/cs2): the same weapons, knives, skins, patterns,
wear and movement, in a case-opening game.

- **Cases**: Blue, Purple, Pink, Red and Gold. Each colour guarantees that rarity (Standard, Superior,
  Exotic, Mythic) from Vantage's full skin list; the Gold Case always gives a ★ knife (random knife type,
  random finish). Float, pattern number and tally roll exactly like Vantage. Opening is free.
- **Inventory**: every skin you've unboxed, with 3D inspect, float, pattern and pattern names
  (Blue Gems, Full Fades, Doppler phases and gems...). Equip skins to use them in Play.
- **Codex**: every skin in the game. Search (e.g. `karambit sunset fade`), then view it in 3D at any
  wear and any pattern number 0–999, with the pattern templates (Blue Gem, Full Fade, Ruby, Sapphire...)
  listed with their exact pattern numbers.
- **Play**: an open field with Vantage's movement and weapons. Press **B** to pick any gun or knife, stock
  or in any skin you own.

The inventory is saved in your browser (localStorage).

## Run

```bash
npm install
npm run dev
```

## Host on Render

The repo has a Render Blueprint (`render.yaml`) for a free static site: **New → Blueprint**, pick this
repo, **Apply**. Or create a **Static Site** by hand with build command `npm ci && npm run build` and
publish directory `dist`.

## Where things are

- `src/cases/`: the new game (`store.js` cases + inventory, `app.js` menu, `sandbox.js` Play, `cases.css`).
- Everything else in `src/` and `public/models/` is copied from Vantage unchanged (except `main.js`, and
  `assets.js` no longer loads the map models), so skins and weapons stay identical. To pick up new skins
  from Vantage, copy over `src/items/`, `src/weapons.js`, `src/shared/` and `public/models/weapons/`.

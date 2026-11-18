# Kalibri

AI calorie scanner PWA. Source of truth for product scope: `calorie-app.md` (read it before changing behaviour).
Day 1 = Today, Scanner, Progress, Profile. **Day 2 adds analytics — do not add it unprompted.**

## Stack — deviation from calorie-app.md
`calorie-app.md` asks for React + Vite + TypeScript + Tailwind + vite-plugin-pwa + recharts.
Node was not installed on the machine and the user declined installing it, so the app is a **no-build static PWA**:
vanilla ES modules, plain CSS with variables, hand-written SVG charts, hand-written service worker (`sw.js`).
Everything else in the spec (screens, data model, routes, storage key, offline, demo estimator) is followed.
If Node becomes available and the user wants the original stack, port module-by-module; the file layout maps 1:1.

## Run
```bash
python3 server.py        # http://localhost:5173 (SPA fallback for /progress, /profile)
python3 scripts/make_icons.py   # regenerate icons/ (stdlib only)
```
No install step, no build, no tests yet.

## Deploy (permanent link)
Live at **https://gidr0gen.github.io/kalibri/** (GitHub Pages, repo `Gidr0Gen/kalibri`, branch `main`, root).
Publish with ONE command: `sh scripts/deploy.sh "message"` — commits, pushes to GitHub (Pages rebuilds in ~1 min) and runs `vercel deploy --prod` (adds Node PATH itself).
Paths are base-relative on purpose (`./src/...`, router `BASE` from `import.meta.url`) so the app works at `/` (dev) and `/kalibri/` (Pages). Don't reintroduce absolute `/...` URLs.
Also on **Vercel**: https://kalibri-omega.vercel.app (project `kalibri`, account via `vercel login`; Node lives in `~/.local/node`, so `export PATH="$HOME/.local/node/bin:$PATH"` first). Config: `vercel.json` (SPA rewrite), `.vercelignore`. Not connected to GitHub auto-deploy (needs a GitHub Login Connection in Vercel).
`calorie-app.md` and `.claude/` are git-ignored (not published). Free tunnels (localhost.run) were unreliable — don't use them for the phone. Preview config: `.claude/launch.json` (`kalibri`).

## Layout
- `index.html`, `manifest.webmanifest`, `sw.js` (network-first + cache fallback; **add new shell files to `SHELL` and bump `CACHE`**)
- `src/main.js` — route table, SW registration
- `src/lib/router.js` — History-API router + tab bar; re-renders the active screen on any store change
- `src/lib/storage.js` — **all** localStorage access, single key `kalibri-v1`, metric units only
- `src/lib/estimator.js` — `estimate(image: Blob)`; simulated (10 sample meals, ±15% grams). Only API the scanner calls — swap for real AI here
- `src/lib/nutrition.js` — Mifflin–St Jeor / TDEE recommendation
- `src/lib/analytics.js` — PostHog (CDN-loaded, no build). Set `POSTHOG_KEY` to enable; empty = no-op. `track(name, props)`; pageviews sent by router; scanner emits `scan_started/analyzed/failed/saved`. Never send meal names, weights or photos
- `src/lib/ui.js` — sheet, confirm dialog, items editor; `src/lib/util.js` — DOM `h()`/`svg()`, dates, image resize, unit conversion
- `src/screens/{today,scanner,progress,profile}.js` — one file per screen
- `src/styles/tokens.css` — **all** colors/radii/spacing/fonts; the app must be restylable from this file alone. `app.css` uses only tokens

## Conventions / rules from the spec
- Name "Kalibri" appears in UI, `<title>`, manifest, icons (letter K).
- No backend, DB, auth, or real AI API calls.
- Store only a 240px JPEG thumbnail per scan; avatar is 256×256 square.
- Mobile first (390×844), content max 480px, safe-area insets, 44px touch targets, WCAG AA contrast.
- Profile changes save immediately (no Save button). Imperial/metric conversion happens in the UI only.
- `calories`/`protein` goals read from scans; never store entries for them. Body weight = manual goal titled "Body weight"; latest entry is the current weight.
- Screens are plain functions returning DOM; state changes call `store.update()` which re-renders. Text inputs that must keep focus use `update(fn, { silent: true })`.

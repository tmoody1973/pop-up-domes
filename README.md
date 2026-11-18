# Pop-up Domes

A browser walking toy: Milwaukee's Mitchell Park Horticultural Conservatory ("The Domes") as a papercraft pop-up book. A tiny paper traveller walks the site while the three conoid glass domes fold up out of the page.

**Status:** playable. All three domes (Desert, Tropical, Show) fold up out of the page as you walk near and have interiors you can walk into through their doorways. Day, dusk and night (lit lanterns after dark), free zoom, phone touch gestures and an opening overview of the whole site are all in. See `LOG.md` for the build history.

**Live:** <https://pop-up-domes.vercel.app/>

## Run it

```bash
cd app
npm install
npm run dev
```

## Controls

The game opens on an overview of the whole site. Tap, click or press any key to start.

| Keyboard and mouse / trackpad | What it does |
| --- | --- |
| WASD or click | Walk |
| Shift (hold) | Run |
| Ctrl (tap on its own) | Slow stroll, on / off |
| N | Day / dusk / night |
| M | Music on / off |
| V | Next camera view |
| Scroll, trackpad pinch, `+` / `-` / `0` | Zoom in / out / reset |

| Phone / touch | What it does |
| --- | --- |
| Tap | Walk |
| Pinch | Zoom |
| 2-finger tap | Day / dusk / night |
| 3-finger tap | Next camera view |
| 4-finger tap | Music on / off |

The hint at the bottom of the screen shows the same list (the touch version on phones).

## URL parameters

Add these to the address, e.g. `http://127.0.0.1:5273/?quality=low&mute=1`.

| Param | What it does |
| --- | --- |
| `?quality=low\|med\|high` | Fix the render quality and turn off the automatic step-down. Default is `med`, which steps down by itself on slow devices. |
| `?intro=0` | Skip the opening overview and start with the traveller. |
| `?hint=0` | Hide the controls hint (also skips the opening overview). |
| `?dusk=1` | Start at dusk. |
| `?night=1` | Start at night. |
| `?mute=1` | Start with sound off. |
| `?seed=N` | Seed for the small random choices (default 7). The site plan itself is fixed. |
| `?life=0` | Turn off ambient life and weather. |
| `?animals=0` | Turn off the paper animals. |
| `?domes=0` | Leave out the three domes entirely (a debug switch, e.g. for measuring their cost). |
| `?debug=1` | Expose internals as `window.__domes` in the browser console. |

## Checks

CI (`.github/workflows/ci.yml`) runs on every push to `main` and every pull request. To run the same steps locally:

```bash
cd app
npm ci
node src/render/autoquality.check.mjs   # self-check for the automatic quality step-down
npm run build
```

There is no test, lint or type-check script. The geometry, door, collision, fidelity and performance checks live under `evidence/` (for example `evidence/wave5/fidelity-checks/`, `evidence/wave4/doors-checks/`, `evidence/perf/`). They are run by hand, need a running app and a browser, and **CI does not run them**.

Frame-time budgets only count when measured headed (a visible browser window, not headless), on an idle machine, at `?quality=med`. Headless numbers are vsync-capped and noisy.

## What's here

| Path | What |
| --- | --- |
| `app/` | The three.js + Vite app, forked from [Papertrails](https://github.com/xikhar/papertrails) at commit `3bced70` |
| `PROMPT.md` | The build spec the agents work from |
| `docs/decisions/` | Decision log: what we chose, what we gave up |
| `LOG.md` | Append-only build log |
| `Mitchell-Park-Domes-Reference/` | Photos, plans and measurements of the real building |
| `evidence/` | Screenshots proving each build step |

## Credits and licences

- **Code:** forked from [Papertrails](https://github.com/xikhar/papertrails) by Shikhar, MIT License (`app/LICENSE`). Changes in this repo are also MIT.
- **Photos** in `Mitchell-Park-Domes-Reference/` are from Wikimedia Commons under CC BY-SA 3.0/4.0 or public domain. Per-file authors and links: `Mitchell-Park-Domes-Reference/CREDITS.md`. Share-alike applies to derivatives of those photos.
- **Plans** come from the National Register of Historic Places nomination (City of Milwaukee, public document); the structural section is US Patent 3,192,668 (public domain).
- Not affiliated with Milwaukee County Parks or the Milwaukee Domes Alliance.

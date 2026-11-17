# Pop-up Domes

A browser walking toy: Milwaukee's Mitchell Park Horticultural Conservatory ("The Domes") as a papercraft pop-up book. A tiny paper traveller walks the site while the three conoid glass domes fold up out of the page.

**Status:** early build. The site map and finite book are in; the domes themselves are next.

## Run it

```bash
cd app
npm install
npm run dev
```

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

# Build "Pop-up Domes": Milwaukee's Mitchell Park Domes as a pop-up-book walking toy, in Three.js

Adapted from the "Pop-up Atlas" prompt (`style-reference/00_original-popup-atlas-prompt.jpeg`).

## Start from

Fork https://github.com/xikhar/papertrails (MIT, three.js 0.187 + Vite) into `./app`. It is the finished Pop-up Atlas: paper traveller, spring fold engine (`src/world/fold.js`), paper materials, tilt-shift post, procedural paper audio, follow camera. Keep its `LICENSE` and credit its author in the README. Its look and its machinery (fold engine, materials, post, audio, traveller, camera) are what we keep. Its world is what we replace: the endless generated countryside goes, and the entire book becomes the Mitchell Park Domes.

The code cites files the repo does not contain: `docs/ARCHITECTURE.md`, `tools/blender/*.py` (tile builders), `tools/checks/*`, `ref/CHECKLIST.md`, `ref/TARGET.md`, `docs/LOG.md`. Only the built `public/models/tiles.glb` + `assets_meta.json` ship. Before adding props, reconstruct the flap conventions (hinge pivots, `userData.delay / stiffness / wobble`) from `fold.js`, `world.js` and the glb, and write them to `app/docs/ARCHITECTURE.md`.

## Reference

Two kinds, each with its own judge (see How to work).

- **Look**, match exactly: `app/screenshots/*.png`, `style-reference/01_concept-frames.jpeg`, `style-reference/02_sprite-atlas-and-hinged-cards.jpeg`. Matte printed cardstock cards on hinges, limited warm palette, lantern light. Palette targets in `app/src/core/config/render.js` (ΔE00 ≤ 5).
- **Subject**, match faithfully: `Mitchell-Park-Domes-Reference/`. Read its `README.md`, then `BUILD-NOTES.md`, first. BUILD-NOTES is the source for dimensions, the profile table, panel tiers and dome centres; cite it, copy nothing out of it. `00-overview.jpg` is a contact sheet of every photo.
- **Known errors in the pack:**
  - BUILD-NOTES §4 and `07_schematic-site-diagram.png` put the lobby in the Show–Desert gap. The plan (`03-floor-plans/06_nrhp-boundary-site-plan.jpg`, `01_existing-first-floor-plan.jpg`) is right: the lobby is a central hub touching all three domes, short link galleries join Show–Desert and Desert–Tropical, and the entrance arcade with two reflecting pools faces south-west, between Show and Tropical. Photo `01-exterior/07` confirms it: Desert is centred behind the arches.
  - `02-interior/30_tropical-glass-grid.jpg` is the Desert Dome (its Commons title says so; cacti in frame).
  - Only `02-interior/31` is confirmed Tropical; `24`–`26` are inferred and show only canopy and apex. No ground-level Tropical photo exists in the pack.

First generate 4–6 Domes concept frames in the look: tilt-shift pop-up book at dusk, three pointed glass domes rising from the page, paper traveller under the entrance arches, one dome cut away to show its planting. Give the imagegen the subject photos as image references so the silhouette is right. These frames are the look target for every Domes component.

## Details

A small paper traveller walks across an open pop-up book whose one spread is Mitchell Park: the three domes, the lobby, the arcade, the reflecting pools, the entry drive and the park lawn around them. Nothing else. Every cell comes from the plans; nothing is generated.

- **Axes.** BUILD-NOTES uses +y = north. Papertrails uses north = −Z (`core/models.js:15`, camera looks toward −Z). Map world z = −y, or the site mirrors.
- **The book.** A finite spread sized to the park plus a lawn margin, with real page edges, and one spine (gutter) running through a gap between domes, never through one. Today the page follows the traveller and repeats its spine every `gutterPeriod` tiles to fake an endless book (`world/book.js`, `config/world.js`); replace that with the fixed spread. The traveller stays on the page: walking into an edge stops them at the margin.
- **Scale.** Derive it from the camera and the spread, not from a round number. Start near 24 ft per tile. Traveller and plants may be up-scaled for legibility. Log both factors.
- **Site map.** Replace `createWFC` in `main.js` with a `createSiteMap` that returns hand-authored cells through the generator's public contract (`seed`, `get`, `peek`, `ensureRegion`, `size`, `stats`, `chunkSize`, `chunkInfo`), and pass it everywhere `wfc` goes today: `createWorld`, `createLife`, `createAnimals`, `createGame`. Cells outside the spread return an empty "off-page" cell. Once `main.js` no longer imports `world/wfc.js`, its 96-option limit (`wfc.js:49`) stops applying; remove `world/wfc.js` and `core/config/wfc.js` from the build.
- **The domes.** The silhouette is what makes them read as Milwaukee: a pointed conoid, widest about 40 % up, closer to a beehive than a ball (BUILD-NOTES §1–2). Build each dome from the same mechanism as every papertrails card: printed cardstock flaps on hinges, driven by `fold.js`.
  - Each gore (an orange-peel slice cut to the profile table) is segmented by tier into nested flaps (`fold.js` NESTED regime), folding inward tier by tier rather than as one long flap, so a folded dome stays inside its own footprint.
  - The apex cap drops in last, the way a crane lifted the real one into place (`04-structure-details/01_construction_apex-ring-lifted-into-place.png`).
  - The lattice is die-cut from the card and the panes are translucent vellum, so the planting reads through. The print carries the tier order (hex → diamond → triangle → ring beam, BUILD-NOTES §3) with a dark hub dot at each node.
  - A dome is a set-piece with its own rise trigger (traveller within ~2 tiles of its base ring), not the per-tile `REVEAL_RADIUS`, so it rises whole.
  - Saw-tooth louvred base ring. Ribbed apex cap with a blue-white halo at dusk and night (photo `01-exterior/12`).
- **Going inside.** The camera-side sector of gores is its own fold instance (`setTarget` acts per instance). When the traveller enters, that sector folds flat (a cutaway) and the interior pops up; leaving reverses it.
- **Camera.** Add a park pose (pulled back, still high-angle tilt-shift) so a whole dome fits in frame on approach; the default rig frames ~9 units, narrower than a dome. Keep the default pose for walking interiors.
- **Biomes.** `core/biomes.js` is marked FROZEN and scatters biomes by noise, and light, weather, wind and exploration all read it by position. Replace its body with a lookup into the site map's regions (each dome's footprint, the lawn), keeping the function names `biomeIndexAt`, `biomeInfo`, `biomeWeights` so callers are untouched; log the unfreeze. Page tint, light and particles then agree at every spot.
  - Desert Dome → `desert`: cacti, red sandstone rockwork. Photos `02-interior/` 15, 19, 20, 22, 29, 30.
  - Show Dome → `blossom` (it already has a gazebo tile): gazebo, pond, seasonal beds. Photos 16, 17, 27, 28.
  - Tropical Dome → new `tropical`: palms, dense canopy. Photo 31 (24–26 inferred). Add a pond only if you source a CC-licensed ground-level photo and add it to `CREDITS.md`.
  - Park grounds → `heartland`.
  - A new biome touches every per-biome table (find them with `grep -rn pinewood src`) and the positional `B()` helper in `core/models.js`; an unknown biome silently falls back to index 0.
  - New props get printed-card art in the style of `02_sprite-atlas-and-hinged-cards.jpeg`, drawn from the photos.
- **Approach.** Entry drive (`01-exterior/01`), past the reflecting pools, under the row of tall pointed concrete arches (`05`, `07`), into the central lobby, with doors to all three domes.
- **Dusk.** Day/night is a binary toggle today (`render/daynight.js`). Add `?dusk=1` holding the blend near 0.5, and register the halo materials in the glow list (it is collected once at startup, so materials added later are missed).
- **Keep from papertrails:** fold springs that overshoot, settle and wobble; a soft paper flap with varied pitch on every fold; high-angle tilt-shift camera with strong DOF; warm key + cool fill; WASD or click to walk (Shift to run); smooth camera follow. The game layer (`src/game/`: scraps, lanterns, atlas map) was built for endless exploration; it has no off switch, so stub `createGame` out in `main.js` until the site reads right, and log what was cut.
- **Labels** are printed on the page like a map (dome names, Layton Blvd). All UI stays diegetic, part of the paper world.

## Tools

- **Dome shell:** generated in code from the BUILD-NOTES profile table, so it stays exact and tweakable.
- **Props:** Blender 5.2 at `/Applications/Blender.app/Contents/MacOS/Blender` (not on PATH), exported to glTF with hinge pivots and flap userData matching `tiles.glb`.
- **Imagegen:** Codex CLI (`codex`) for concept frames and card art. Confirm image generation works before planning around it; fall back to the `gemini-image-generator` skill.
- **Audio:** reuse `src/audio/paper.js`.
- **Skills on this machine:** `threejs-procedural-architecture` (dome shell, arches), `threejs-camera-direction` (park pose, cutaway framing), `threejs-visual-validation` (fixed views and evidence for the judges).

## How to work

Autonomous, no questions; log assumptions in `LOG.md`, append-only. Study the references, then write a checklist of components with measurable targets. One sub-agent per component, each owns its files, `npm run dev` stays running. Components: site map + finite book; dome shell + fold; entrance + lobby; one per biome interior; prop art; camera (park pose + cutaway); dusk + halo; audio.

Two judges loop on every component, each a separate, blind sub-agent:

- **Look judge.** Side by side, random order, matched view. Domes components are compared with the Domes concept frames; everything else with `app/screenshots/`. Says which is the reference, what gives the new one away, and the fix. **Pass:** 6 trials, the judge picks the reference 4 or fewer times.
- **Fidelity judge.** Measures against the subject. **Pass, all of:**
  - Dome geometry at rest pose: vertex radius within ±3 % of the profile table at every row with u ≤ 0.95, measured at gore seams.
  - Dome centres within ±5 ft (scaled) of BUILD-NOTES §4 after the z = −y mapping; the three domes identical.
  - Lobby, links and arcade placed as in plan `06`.
  - Apex cap last in the fold order.
  - Biome check as a 3-way forced choice: shown all three domes' photo sets and one interior render, the judge names the right dome.

Feel and performance targets:

- **Fold feel:** rise ~0.25 s, 8–15 % overshoot, 4–7 Hz flutter, settled in 0.6–1.1 s (`config/fold.js` header).
- **Performance:** p95 frame time ≤ 16.7 ms on this machine at `?quality=med`, with three risen domes in view; log draw calls from `renderer.info` and hold them within 1.5× the papertrails baseline at the same view.
- Walking feel and sound: judged by eye and ear against papertrails.

Revert anything that makes it worse. A component ends at PASS, or after 5 rounds / 2 rounds without a judged gain as a logged FAIL with its scores and the reason. The user's explicit instructions override the judges.

## Rights

- The photos are CC BY-SA. Card art is drawn fresh rather than traced or sampled from photo pixels.
- The concept frames are generated from those photos, so treat them as derivatives: if they ship (side-by-sides, README), license them CC BY-SA with attribution.
- Ship `Mitchell-Park-Domes-Reference/CREDITS.md` and papertrails' `LICENSE` with any published build.
- The `style-reference/` images belong to someone else: reference only, absent from every deliverable including the side-by-sides.
- No Milwaukee County or Domes Alliance logos.

## Deliver

- Playable Vite build + run instructions.
- A 45-second capture at dusk, run allowed: entry drive → reflecting pools → arches → lobby → into one dome (cutaway) → through a link gallery into a second.
- Final side-by-sides with both judges' scores.
- A component table: PASS, or FAIL with reason.
- `LOG.md`.

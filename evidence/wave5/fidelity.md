# Wave 5 fidelity judge (measured) — 2026-11-17 [wave5-L]

Pass list from PROMPT.md "How to work" (Fidelity judge + Feel and performance targets). No app source changed.
Geometry, order and feel are measured in Node on the source modules (rest pose, both fold instances snapped up).
Performance is measured in headless system Chrome on a private `vite preview` build of the tree as it stood at 14:05.

| # | Check | Target | Measured | Verdict |
|---|---|---|---|---|
| a | Seam vertex radius vs BUILD-NOTES §2 profile, rows u ≤ 0.95, every dome | ±3 % | 32 seams per dome, 15 rows: error +0.10 .. +1.82 % (worst at u = 0.95). The three domes are identical | **PASS** |
| b1 | Dome centres vs BUILD-NOTES §4 after z = −y | ±5 ft | Show (0, 0), Desert (169, 0), Tropical (169, −158) ft as built: 0.00 ft error. This only shows that SITE copies §4. See (c) for an independent reading of the plan | **PASS** |
| b2 | Three domes identical | identical | Same 145-card set. Card transforms relative to the centre match within 4.7e-15 units, and the radius tables match. Only the doorway-notched cards differ (10 on Desert, 8 on Tropical vs Show); this is the [wave4-J] door design | **PASS** |
| c | Lobby, links and arcade placed as in plan 06 | as in plan (±5 ft used, the pack's own tolerance) | Layout matches: the hub touches all three domes, links sit in the Show–Desert and Desert–Tropical gaps, and the arcade faces SW between Show and Tropical (bearing 228.4° north-up, 226.0° registered, vs 225°). Positions: links 3.6–14.8 ft, lobby hub 10.0 / 16.2 ft, arcade front 8.5 / 14.4 ft, pools 3.3–6.7 ft (table below) | **Layout PASS. Position FAIL** for the lobby centre and arcade front at ±5 ft |
| d | Apex cap last in the rise order | last | Cap starts at 1.150 s. The last other flap starts at 1.058 s (all 145 flaps, main + sector). The cap is also the first to fold down. Same on all three domes | **PASS** |
| e | Fold feel (config/fold.js header) | rise ~0.25 s, overshoot 8–15 %, flutter 4–7 Hz, settle 0.6–1.1 s | One gore + cap at 1/240 s. Lead flaps rise in 0.254 s (ring) and 0.267 s (tier 1). Nested tiers 2–8 follow their parent in 0.137–0.146 s, the cap in 0.133 s. Overshoot 9.9–14.7 %, flutter 4.4–5.2 Hz, settle 0.82–0.99 s per flap. The whole dome sweep settles in 1.98 s and fold-down in 1.94 s (the stagger span is 1.15 s by design, so the cap lands last) | **PASS** per flap |
| f1 | p95 frame time, ?quality=med, three domes risen, dusk | ≤ 16.7 ms | k1 framing, 1512×762 @2x, 10 s. rAF interval p50 40.7 / p95 65.0 ms. Busy time (frame callback + gl.finish) p50 42.3 / p95 74.0 ms. Baseline at the same view with ?domes=0: rAF p95 128.5, busy p95 59.4 ms. At @1x: domes p95 69.5 / busy 65.9 ms, ?domes=0 71.8 / 49.5 ms | **FAIL / not verifiable** (see note) |
| f2 | Draw calls | ≤ 1.5× baseline at the same view | 106 with domes vs 102 with ?domes=0 = **1.04×**. 165k vs 88k triangles | **PASS** (against the ?domes=0 stand-in) |

## (c) Plan 06 measurement

Method (`fidelity-checks/plan06.py`, overlay `fidelity-checks/plan06-overlay.jpg`):

- **Dome outlines.** Least-squares circle fits to the outer edge of the green fill. Only rays that end on white paper are used. Fit points: Show 281, Tropical 301, Desert 135. Median residuals: about 1 px for Show and Tropical, 2.5 px for Desert.
- **Scale.** Show and Tropical diameters (474.7 and 473.5 px) are set to 140 ft, giving **3.387 px/ft**. Most of the Desert rim is buried in additions, so its free fit ran large (497 px). Its centre is refit with the radius held at that scale.
- **Feature points.** Picked by eye on 2× zooms with a 50-px grid (`fidelity-checks/picks.json`). Reading error is about ±10 px, or ±3 ft:
  - lobby hub = the centre of the lens planter
  - each link = the midpoint between the two door lines in its gap
  - arcade front = where the axis between the pools meets the pier row on the SW facade
  - pools = their rectangle centres
- **Two frames:**
  - **North-up:** the plan's north arrow is vertical, and the Show centre is the origin.
  - **Registered:** a least-squares rigid fit of the three plan dome centres onto the §4 / SITE centres. The plan sits 2.3° off the squared-up §4 axes.

| Feature | Plan ft (north-up) | Error ft | Plan ft (registered) | Error ft | SITE ft |
|---|---|---|---|---|---|
| Show Dome centre | (0.0, 0.0) | 0.0 | (−0.2, 4.5) | 4.5 | (0, 0) |
| Desert Dome centre | (164.3, −12.5) | 13.3 | (164.4, −1.3) | 4.7 | (169, 0) |
| Tropical Dome centre | (167.1, −172.7) | 14.8 | (173.8, −161.2) | 5.8 | (169, −158) |
| Lobby hub centre | (94.4, −77.4) | 10.0 | (97.2, −69.0) | 16.2 | (84.5, −79) |
| Link Show–Desert (midpoint) | (81.7, −2.1) | 3.6 | (81.5, 5.7) | 6.4 | (84.5, 0) |
| Link Desert–Tropical (midpoint) | (167.6, −93.7) | 14.8 | (171.1, −82.3) | 3.9 | (169, −79) |
| Arcade front (centre) | (60.4, −112.0) | 8.5 | (64.7, −105.0) | 14.4 | (52.0, −111.5) |
| Pool W (centre) | (7.8, −127.6) | 6.7 | (12.8, −122.7) | 6.4 | (6.7, −121) |
| Pool E (centre) | (38.8, −162.2) | 6.7 | (45.2, −156.0) | 3.3 | (42, −156.3) |
| Arcade axis bearing | 228.4° | 3.4° | 226.0° | 1.0° | 225° |

Readings:

- **Dome triangle.** Read north-up, the plan puts Desert 12.5 ft south of Show's line and makes Show–Tropical 240 ft (SITE: 231.5 ft). BUILD-NOTES §4 squares the triangle to the axes. Registered, the three centres agree with §4 to 4.5–5.8 ft, which is the ±5 ft that §4 states.
- **Lobby.** SITE uses the circumcentre of the three domes (84.5, −79), inside a 45-ft-radius hub. The plan's central planter sits 10–16 ft east / north-east of it. That is inside SITE's hub disc, but outside ±5 ft as a point.
- **Arcade.** The SITE arcade line is 8.5 ft (north-up) to 14.4 ft (registered) further west / south-west than the plan's pier row. The [wave2-E] note moved the arch feet to t = 50 ft so the pools clear the row. The bearing agrees within 1–3.4°.
- **Caveat.** The scale assumes the drawn green rim is the 140 ft glass foot. If the rim is the planter wall outside the glass, every plan distance shrinks by the same factor.

## (f) Performance: why it is not a usable verdict

- **Load.** Headless Chrome on a loaded machine: load average 3.6 at the start, 11.2 during the @1x run.
- **Vsync and frame-rate limits.** Both are off (`--disable-gpu-vsync --disable-frame-rate-limit`), but rAF intervals still show 1–2.5 s stalls (max column).
- **Baseline is also over budget.** The ?domes=0 baseline runs 27–46 ms p50 at the same view, so the 16.7 ms target cannot be met or failed by the domes from here.
- **What the domes cost.** About +3 ms (@2x) to +10 ms (@1x) busy-time p50 against ?domes=0. That is within run-to-run noise: domes=0 was slower in rAF terms in the @2x run.
- **Draw calls.** These are exact, and the domes add 4.
- **The 1.5× rule.** The "papertrails baseline" (the original countryside world) is not in this tree, so ?domes=0 at the same view stands in for it.
- **To get a real verdict:** run on an idle machine in a focused, visible window (wave2-D said the same).

## Files

- `fidelity-checks/fidelity.mjs` → `fidelity.out`: (a), (b), (d)
- `fidelity-checks/feel.mjs` → `feel.out`: (e) (the wave2 script, re-run unchanged)
- `fidelity-checks/plan06.py` + `picks.json` → `plan06.out`, `plan06.json`, `plan06-overlay.jpg`. In the overlay, red = dome fits, blue = plan picks, magenta X = SITE positions projected north-up.
- `fidelity-checks/perf.mjs` → `perf.out` (@2x), `perf-dpr1.out` (@1x). Console: no errors or warnings.

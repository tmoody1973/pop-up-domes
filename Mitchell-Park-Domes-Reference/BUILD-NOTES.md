# Build notes — Mitchell Park Domes in three.js

Everything below is in feet. Use 1 unit = 1 ft and the numbers are directly usable.

## 1. Massing

Three identical domes, 140 ft across the base and 85 ft tall, standing clear of each other on a low fieldstone plinth. Each is a **conoid**, not a hemisphere and not a geodesic sphere: the section bulges outward above the base, reaches its widest point about 40 % of the way up, then tapers to a small flat apex cap. The silhouette is closer to a pointed ogive or a beehive than to a ball.

At the foot of each dome is a ring of triangular louvered panels — the fresh-air intake — set between peaks of a saw-toothed concrete wall. That ring is slightly narrower than the glass above it, so the glass appears to overhang it. Each apex carries a flat, ribbed, opaque cap with the exhaust fan inside it, ringed by an LED halo that lights at night.

Between the domes sit a low lobby and two short link galleries. The entrance front is a row of tall pointed concrete arches.

## 2. Profile

The table is normalised: `u` is height above the base divided by total height (85 ft), `r` is radius divided by maximum radius (70 ft). It was fitted to the silhouette of `01-exterior/04_single-dome-facade.jpg`, so expect small perspective error near the ground.

| u (y / 85 ft) | r (x / 70 ft) | height above base |
| --- | --- | --- |
| 0.00 | 0.93 | 0 ft |
| 0.10 | 0.96 | 8.5 ft |
| 0.20 | 0.985 | 17 ft |
| 0.30 | 1.00 | 25.5 ft |
| 0.41 | 1.00 | 35 ft |
| 0.50 | 0.91 | 42.5 ft |
| 0.55 | 0.88 | 47 ft |
| 0.60 | 0.85 | 51 ft |
| 0.65 | 0.79 | 55 ft |
| 0.70 | 0.70 | 59.5 ft |
| 0.75 | 0.62 | 64 ft |
| 0.80 | 0.56 | 68 ft |
| 0.85 | 0.46 | 72 ft |
| 0.90 | 0.37 | 76.5 ft |
| 0.95 | 0.19 | 81 ft |
| 1.00 | 0.00 | 85 ft |

The apex is truncated in reality: the opaque cap is roughly 8–10 ft across. Stop the glass at about `u = 0.985` and cap it with a disc.

For a quick blockout, a smooth fit through those points is:

```js
const R = 70, H = 85;
// t = 0 at base, 1 at apex
const profile = (t) => R * (0.93 + 0.07 * Math.sin(Math.PI * t * 0.5)) * Math.pow(1 - t, 0.62);
```

That is only a stand-in for the table. Expressing the real shape as a `CatmullRomCurve3` through the twelve or so most reliable table rows, then calling `getPoints(64)`, gives a cleaner lathe.

## 3. Panel grid

The skin is not a uniform triangulated sphere. Read from the base up, the precast concrete frame steps through:

1. Three tiers of **hexagonal** units, each hex with six spokes running from its centre to the corners. Hexagons shrink as they rise.
2. Two tiers of **diamond** units, each with a cross strut.
3. One **triangular** tier.
4. A **ring beam**, then the separately cast apex cap, itself two concentric rings with radiating ribs.

Panels are flat-ish triangles and diamonds set in aluminium frames, held a few inches proud of the concrete by 8-inch-diameter hubs. The visual signature is the dense white lattice and the small dark hub at every node, so model the lattice rather than relying on a glass texture.

Useful counts, documented and derived:

- 115,000 sq ft of quarter-inch wire-reinforced plate glass across the three domes, so about 38,300 sq ft per dome.
- 5,500 hubs total, about 1,830 per dome.
- 120,000 linear ft of aluminium extrusion, 240,000 ft of neoprene gasket.

1,830 hubs per dome is a good target for panel count. At 38,300 sq ft that averages roughly 21 sq ft per panel, which matches a pane about 4 × 5 ft. A practical mesh is 32–36 radial sectors by 28–34 rings, with panel size held near constant by adding sectors in the lower, wider rings.

Sketch of the ring layout in `u`:

```js
const rings = [0, 0.06, 0.13, 0.20, 0.27, 0.34, 0.41, 0.48, 0.55, 0.62, 0.69, 0.76, 0.83, 0.89, 0.94, 0.98];
// tiers: rings 0-4 hex, 4-8 diamond, 8-12 triangle, 12+ closing bands to the apex
```

## 4. Site layout

Centre-to-centre spacing scaled from the existing first-floor plan, so treat as ±5 ft:

- Show Dome (A) at `(0, 0)`
- Desert Dome (B) at `(169, 0)`
- Tropical Dome (C) at `(169, -158)`

With 140 ft diameters, that leaves a 29 ft gap between A and B, which the lobby fills, and an 18 ft gap between B and C for the link gallery. The entrance front faces south-west toward S. Layton Blvd. `03-floor-plans/07_schematic-site-diagram.png` shows the arrangement, and `03-floor-plans/06_nrhp-boundary-site-plan.jpg` labels the same three domes.

## 5. Materials and light

The concrete is a warm grey-beige, slightly stained; the plinth is rough fieldstone in browns and greys. Mullions and hubs read as off-white aluminium, not chrome.

For glass, `MeshPhysicalMaterial` with `transmission: 0.9`, `roughness: 0.12`, `ior: 1.5`, `thickness: 0.2` and an environment map looks right, but transmission on thousands of small panels is expensive. Cheaper and nearly as convincing: opaque panels with a low-opacity additive blend plus a baked reflection gradient, and let the interior geometry show through only where the camera is inside. Set `depthWrite: false` and sort panels back to front, or the lattice will z-fight.

Inside, the plant mass matters as much as the architecture. Crossed alpha-tested billboards for foliage, a warm directional light from the apex, and a thin fog tinted green (tropical) or dusty ochre (desert) sell the scale.

At night, an emissive torus at each apex plus a point light just below it reproduces the halo lighting.

## 6. Which file to open for what

- Overall silhouette and the panel rhythm: `01-exterior/04_single-dome-facade.jpg`, `01-exterior/02_facade-panel-grid-detail.jpg`
- Entrance arches and buttresses: `01-exterior/05_buttress-arch-detail.jpg`, `07_entrance-arches-symmetrical.jpg`
- Apex cap and compression ring: `02-interior/18_apex-ring-from-below.jpg`, `21_apex-ring-detail.jpg`, `23_apex-ring-against-sky.jpg`
- Interior volume and roof structure from inside: `02-interior/16_glass-grid-from-inside.jpg`, `24`–`27`
- Night lighting: `01-exterior/12_illuminated-at-night.jpg`
- Construction and connection logic: `04-structure-details/`
- Plans: `03-floor-plans/01_existing-first-floor-plan.jpg` for the footprint, `04_dome-structural-section-patent.jpg` for the shell section

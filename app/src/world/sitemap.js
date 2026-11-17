// The site map: Mitchell Park, hand-authored. Replaces the endless WFC countryside (world/wfc.js) and returns the
// SAME public contract as createWFC (seed, get, peek, ensureRegion, size, stats, chunkSize, chunkInfo), with cells
// shaped like WFC cells ({ x, z, tileId, model, rot, sockets, tags, biome }) plus { region, domeId }.
// Every cell comes from SITE below; nothing is generated.
//
// Axes: SITE is in FEET, +x = east, +y = north (BUILD-NOTES §4), origin = Show Dome centre. Papertrails has
// north = -Z (core/models.js:15), so cell z = -y / ftPerTile (z = -y), or the site mirrors.
import { MODELS, rotateSockets } from '../core/models.js';
import { TILE_SIZE } from '../core/config.js';

export const SITE = Object.freeze({
  // Scale (LOG.md [wave1-A]): the book's cell torus (world/book.js GRID = 32) caps the spread at 30 cells; the spread is
  // symmetric about the spine and must hold the drive turnaround (x = -144 ft) through the east domes (x = 239 ft):
  // 2 * max(84 + 144, 239 - 84) = 456 ft + 2 x 2 margin tiles -> >= 17.5 ft/tile. A dome must stay >= ~5 tiles across
  // so its gores and tiers read -> <= 28 ft/tile. 24 ft/tile: a dome is 5.8 tiles (11.7 world units).
  ftPerTile: 24,
  // Dome centres: BUILD-NOTES §4 (scaled there from 03-floor-plans/01_existing-first-floor-plan.jpg, ±5 ft).
  // r: BUILD-NOTES §1, 140 ft base diameter. Biome lookup: PROMPT.md "Biomes" (tropical -> heartland until it exists).
  domes: [
    { id: 'show', x: 0, y: 0, r: 70, biome: 'blossom' },
    { id: 'desert', x: 169, y: 0, r: 70, biome: 'desert' },
    { id: 'tropical', x: 169, y: -158, r: 70, biome: 'heartland' }, // ponytail: no `tropical` biome yet (LOG.md)
  ],
  // Lobby: plan 03-floor-plans/06 (NOT BUILD-NOTES §4, which wrongly puts it in the Show-Desert gap): a central hub touching
  // all three domes = the point equidistant from the three centres. The triangle is right-angled at Desert, so that is the
  // midpoint of Show-Tropical (84.5, -79), 115.7 ft from each centre; r = 115.7 - 70 - ~1. Plan 06 measures (76, -84).
  lobby: { x: 84.5, y: -79, r: 45 },
  // Walkable strips, in feet, rasterised 4-connected. Region names are what other modules key on.
  paths: [
    // Link galleries: plan 06 + BUILD-NOTES §4 gaps (29 ft Show-Desert, 18 ft Desert-Tropical).
    { region: 'link', pts: [[70, 0], [99, 0]] },
    { region: 'link', pts: [[169, -70], [169, -88]] },
    // Entrance arcade: plan 06, faces south-west between Show and Tropical, on the lobby's SW axis (bearing 225 deg).
    // [wave2-E] Arch feet at t = 50 ft along the axis (front wall t = 42), so the pools (t = 58..112) clear the row;
    // arcade region t = 40..52, walk between the pools to the plaza at t = 120.
    { region: 'arcade', pts: [[56.2, -107.3], [47.7, -115.8]] },
    { region: 'walk', pts: [[47.7, -115.8], [0, -163.9]] },
    // Entry drive: plan 06, from S. Layton Blvd (south-west, off the page) to the turnaround (centre measured at
    // (-106, -195) ft, 2.1 px/ft on the 2000 px plan), then up to the plaza.
    { region: 'drive', pts: [[-400, -400], [-106, -195], [0, -163.9]] },
  ],
  // Reflecting pools: plan 06, two long pools flanking the walk, centred t = 85 ft down the axis, 25 ft either side
  // (plan 06 measures (8, -126) and (39, -157)); long axis along the walk. [wave2-E] 54 x 14 ft (t = 58..112, so
  // they clear the arch row at t = 50 and the 18-ft plaza at t = 120); plan 06 reads ~60 x 15 ft.
  pools: [
    { x: 6.7, y: -121, len: 54, width: 14 },
    { x: 42, y: -156.3, len: 54, width: 14 },
  ],
  axis: [-Math.SQRT1_2, -Math.SQRT1_2], // unit vector, lobby -> south-west (plan 06)
  // Spine (book gutter), on a tile seam through the Show | Desert-Tropical gap (Show ends x = 70, Desert / Tropical start
  // x = 99). 84 ft = tile seam 3.5 at 24 ft/tile; it runs through the lobby, never through a dome (asserted below).
  spineX: 84,
  // Lawn margin (tiles) around the site bbox before the page edge.
  marginTiles: 2,
  // Traveller start: the plaza at the foot of the walk, looking up at the arches (feet).
  start: { x: 0, y: -163.9 },
  // [wave2-E] Every cell is plain lawn (`site_lawn`: the meadow ground print, no props, world/site/tiles.js). Walks,
  // drive, pools, hub and labels are printed in world space on top (world/site/print.js); arcade, lobby, poles and
  // trees are set-pieces (world/site/pieces.js). The dome / biome waves swap `dome` for their interior tiles.
  art: { lawn: 'site_lawn', dome: 'site_lawn', lobby: 'site_lawn', pool: 'site_lawn', path: 'site_lawn' },
  // Printed map labels (PROMPT.md "Labels"), feet, size = cap height in feet. On the lawn on the camera side of each
  // dome (labels north of a dome would hide behind it); Layton Blvd runs along the west edge (world/site/print.js).
  labels: [
    { text: 'SHOW DOME', x: -120, y: 8, size: 10 },
    { text: 'DESERT DOME', x: 306, y: -4, size: 10 },
    { text: 'TROPICAL DOME', x: 169, y: -250, size: 10 },
    { text: 'S. LAYTON BLVD', x: -178, y: -60, size: 7.5, rot: -Math.PI / 2 },
  ],
  // Park trees: only where the photos show them (01-exterior/01: a tree on the lawn west of the Show Dome by the drive;
  // 09: a flowering tree on the lawn in front of the arcade), plus one at the turnaround island edge.
  trees: [
    { x: -62, y: -112, sprite: 'trees_a_0' },
    { x: -150, y: -150, sprite: 'trees_a_3' },
    { x: 92, y: -205, sprite: 'trees_a_3' },
  ],
  // Leaf-headed light poles (01-exterior/03, 07) flanking the walk, feet along / across the axis.
  poles: [{ t: 62, s: 13 }, { t: 62, s: -13 }, { t: 104, s: 13 }, { t: 104, s: -13 }],
});

/** Feet (site, +y north) -> world units (x, z) with z = -y. */
export function ftToWorld(xFt, yFt) {
  return [(xFt / SITE.ftPerTile) * TILE_SIZE, (-yFt / SITE.ftPerTile) * TILE_SIZE];
}

const OFF_PAGE = 'off-page';
const PATHISH = new Set(['link', 'arcade', 'walk', 'drive', 'lobby']);

const F = SITE.ftPerTile;
const toCell = (xFt, yFt) => [Math.round(xFt / F), Math.round(-yFt / F)]; // z = -y
const domesT = SITE.domes.map((d) => ({ ...d, cx: d.x / F, cz: -d.y / F, rt: d.r / F }));

// ---- page (tile units; edges on tile seams) ---------------------------------------------------------------------
const PAGE = (() => {
  const xs = []; const zs = [];
  for (const d of domesT) { xs.push(d.cx - d.rt, d.cx + d.rt); zs.push(d.cz - d.rt, d.cz + d.rt); }
  const turn = toCell(-106 - 38, -195 - 38); // turnaround loop, r ~38 ft (plan 06)
  xs.push(turn[0]); zs.push(turn[1]);
  const spine = SITE.spineX / F; // 3.5
  const half = Math.ceil(Math.max(spine - Math.min(...xs), Math.max(...xs) - spine) + SITE.marginTiles);
  const z0 = Math.floor(Math.min(...zs) - SITE.marginTiles) + 0.5;
  const z1 = Math.ceil(Math.max(...zs) + SITE.marginTiles) - 0.5;
  return { spine, x0: spine - half, x1: spine + half, z0, z1 };
})();

/** Is cell (cx, cz) wholly on the spread? */
const onPage = (cx, cz) => cx > PAGE.x0 && cx < PAGE.x1 && cz > PAGE.z0 && cz < PAGE.z1;

/** Dome id whose footprint holds tile-space point (x, z), or null. Pure, allocation-free. */
export function domeAt(x, z) {
  for (const d of domesT) if ((x - d.cx) ** 2 + (z - d.cz) ** 2 <= d.rt * d.rt) return d.id;
  return null;
}

/** The domes in TILE units ({ id, biome, cx, cz, rt }), z = -y. */
export const DOMES = Object.freeze(domesT.map((d) => Object.freeze({ id: d.id, biome: d.biome, cx: d.cx, cz: d.cz, rt: d.rt })));

/** World-unit page rect + spine for the book (world/book.js). tileSize = world units per tile. */
export function pageRect(tileSize) {
  return Object.freeze({
    x: ((PAGE.x0 + PAGE.x1) / 2) * tileSize,
    z: ((PAGE.z0 + PAGE.z1) / 2) * tileSize,
    halfWidth: ((PAGE.x1 - PAGE.x0) / 2) * tileSize,
    halfDepth: ((PAGE.z1 - PAGE.z0) / 2) * tileSize,
    gutterX: PAGE.spine * tileSize,
  });
}

// ---- regions ------------------------------------------------------------------------------------------------------
function buildRegions() {
  const regions = new Map(); // "cx,cz" -> region name
  const key = (cx, cz) => cx + ',' + cz;
  const put = (cx, cz, r) => { if (onPage(cx, cz) && !regions.has(key(cx, cz))) regions.set(key(cx, cz), r); };
  // priority = insertion order: domes, lobby, paths, pools, (lawn = absent)
  for (let cz = Math.ceil(PAGE.z0); cz < PAGE.z1; cz++) {
    for (let cx = Math.ceil(PAGE.x0); cx < PAGE.x1; cx++) {
      const d = domeAt(cx, cz);
      if (d) put(cx, cz, 'dome:' + d);
      else if ((cx - SITE.lobby.x / F) ** 2 + (cz + SITE.lobby.y / F) ** 2 <= (SITE.lobby.r / F) ** 2) put(cx, cz, 'lobby');
    }
  }
  for (const p of SITE.paths) {
    for (let i = 0; i + 1 < p.pts.length; i++) {
      const [ax, ay] = p.pts[i]; const [bx, by] = p.pts[i + 1];
      const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 2); // every 2 ft
      let prev = null;
      for (let k = 0; k <= n; k++) {
        const c = toCell(ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n);
        // 4-connect a diagonal step (staircase), so the path tiles join edge to edge
        if (prev && prev[0] !== c[0] && prev[1] !== c[1]) put(c[0], prev[1], p.region);
        put(c[0], c[1], p.region);
        prev = c;
      }
    }
  }
  for (const pool of SITE.pools) {
    for (let t = -pool.len / 2; t <= pool.len / 2; t += 4) {
      const c = toCell(pool.x + SITE.axis[0] * t, pool.y + SITE.axis[1] * t);
      put(c[0], c[1], 'pool');
    }
  }
  return regions;
}

const REGIONS = buildRegions();

/** Region of cell (cx, cz): 'dome:show' | 'dome:desert' | 'dome:tropical' | 'lobby' | 'link' | 'arcade' | 'walk' | 'drive' | 'pool' | 'lawn' | 'off-page'. */
export function regionAt(cx, cz) {
  if (!onPage(cx, cz)) return OFF_PAGE;
  return REGIONS.get(cx + ',' + cz) || 'lawn';
}

// ---- cells ----------------------------------------------------------------------------------------------------------
function makeCell(x, z, model, rot, region, biome, domeId) {
  const m = MODELS[model];
  const extra = domeId ? ['dome'] : region === OFF_PAGE ? [OFF_PAGE] : [];
  return Object.freeze({
    x, z, tileId: region === OFF_PAGE ? OFF_PAGE : model, model, rot,
    sockets: Object.freeze(rotateSockets(m.sockets, rot)),
    tags: Object.freeze([...m.tags, ...extra]),
    biome, region, domeId,
  });
}

/** Biome of a cell: dome footprint -> that dome's biome, everything else heartland (PROMPT.md "Biomes"). */
const biomeOfRegion = (region) => (region.startsWith('dome:') ? SITE.domes.find((d) => 'dome:' + d.id === region).biome : 'heartland');

function cellFor(cx, cz) {
  const region = regionAt(cx, cz);
  const biome = biomeOfRegion(region);
  if (region === OFF_PAGE) return makeCell(cx, cz, SITE.art.lawn, 0, region, biome, null);
  if (region.startsWith('dome:')) return makeCell(cx, cz, SITE.art.dome, 0, region, biome, region.slice(5));
  if (region === 'lobby') return makeCell(cx, cz, SITE.art.lobby, 0, region, biome, null);
  if (region === 'pool') return makeCell(cx, cz, SITE.art.pool, 0, region, biome, null);
  if (PATHISH.has(region)) return makeCell(cx, cz, SITE.art.path, 0, region, biome, null);
  return makeCell(cx, cz, SITE.art.lawn, 0, 'lawn', biome, null);
}

// The spine must never cross a dome (PROMPT.md "The book").
for (const d of domesT) {
  if (Math.abs(d.cx - PAGE.spine) <= d.rt) throw new Error(`[sitemap] spine x=${SITE.spineX} ft crosses dome ${d.id}`);
}

export function createSiteMap({ seed = 1 } = {}) {
  const cells = new Map();
  const key = (x, z) => x + ',' + z;
  for (let cz = Math.ceil(PAGE.z0); cz < PAGE.z1; cz++) {
    for (let cx = Math.ceil(PAGE.x0); cx < PAGE.x1; cx++) cells.set(key(cx, cz), cellFor(cx, cz));
  }
  const stats = { cells: cells.size, offPage: 0 };
  const [sx, sz] = toCell(SITE.start.x, SITE.start.y);

  return {
    seed: (Number(seed) || 0) | 0,
    /** Cell at (x, z); off the spread an empty 'off-page' cell. Never throws. */
    get(x, z) {
      x = Math.round(+x) || 0; z = Math.round(+z) || 0;
      const c = cells.get(key(x, z));
      if (c) return c;
      stats.offPage++;
      return cellFor(x, z);
    },
    /** Like get(); every on-page cell is authored up front, so peek never returns null on the page. */
    peek(x, z) { return this.get(x, z); },
    /** No-op: the whole site exists from the start. */
    ensureRegion() {},
    get size() { return cells.size; },
    stats,
    chunkSize: Math.max(PAGE.x1 - PAGE.x0, PAGE.z1 - PAGE.z0),
    chunkInfo(x, z) { return { cx: 0, cz: 0, attempts: 0, fallback: false, region: regionAt(Math.round(x), Math.round(z)) }; },
    /** Fixed spread (world units) for the book; `tileSize` = TILE_SIZE. */
    page: pageRect,
    /** Traveller start cell (the plaza below the arches). */
    start: { x: sx, z: sz },
    site: SITE,
  };
}

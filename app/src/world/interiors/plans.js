// Planting plans for the three dome interiors (wave3-H). Pure data + pure helpers (Node-testable, no three.js).
//
// Frame: dome-local world units (1 unit = 12 ft), x = east, z = south (papertrails north = -Z). Bearings `a` in degrees,
// 0 = north (the back of the dome, away from the follow camera), 90 = east, 180 = south (camera side), 270 = west.
// Tall planting goes to the back, low planting to the front, so the traveller stays in view through the cutaway.
//
// Sources (photos, looked at; no pixels used):
//   desert   02-interior/15, 19, 20, 22, 29, 30: saguaro / organ-pipe columns, agaves, tree aloes, fan palms, red
//            sandstone spires and outcrops along a pink-tan path, a bench (19), a small pond in the rockwork (29).
//   show     16, 17, 27, 28: gazebo with a pond in front (28), flower beds, benches on the path (17), tall evergreens
//            (16, 17), a white pergola arch (16). The show changes with the season; the beds are generic.
//   tropical 31 (fan palm reaching the apex), 24-26 inferred (broadleaf canopy, tall palms, banana-like leaves).
//            No ground-level photo: no pond (PROMPT.md "Biomes"; LOG.md [wave3-H]).
import { R, H, rAt, BASE_R } from '../domes/shell.js';
import { network, pathDistance, PATH_HALF } from './paths.js';

export const UNIT_FT = 12;
/** Props stay inside this radius (their outer edge), clear of the glass foot and of the folded cutaway stack. */
export const MAX_R = BASE_R * 0.9;
/** Gap (units) between a prop's footprint and the edge of a walk. */
const WALK_GAP = 0.1;

/** Inner glass height (units) above a point at radius rho from the dome axis (0 if outside the glass). */
export function headroom(rho) {
  const rn = rho / R;
  if (rn <= rAt(1)) return H;
  for (let u = 1; u >= 0; u -= 0.0025) if (rAt(u) >= rn) return u * H;
  return 0;
}

/** Pond discs of a plan in dome-local units: [{ x, z, rad }]. */
export const pondsOf = (id) => PLANS[id].floor.ponds.map((p) => ({ ...p, x: p.u * BASE_R, z: -p.v * BASE_R }));

/** Is a disc (x, z, radius) off every walk (traced plan walks + door spurs, paths.js) and out of every pond? */
export function isClear(x, z, rad, net, ponds = []) {
  if (pathDistance(net, x, z) < PATH_HALF + rad + WALK_GAP) return false;
  return ponds.every((p) => Math.hypot(x - p.x, z - p.z) > p.rad + rad * 0.5);
}

const pol = (a, r) => [Math.sin((a * Math.PI) / 180) * r, -Math.cos((a * Math.PI) / 180) * r];

/** Deterministic PRNG (mulberry32). */
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---- plans --------------------------------------------------------------------------------------------------------
// hero: hand-placed { s: sprite, h: height (units), a, r, cross? } (nudged around the bearing if it blocks a walk).
// fill: { s: [sprites], h: [min, max], n, r: [r0, r1], arc: [a0, a1] (clockwise from a0), cross?, pd?, pack? } scattered with a
//       fixed seed, rejected on walkways, the plaza and each other.
// floor: the printed ground (index.js draws it): ground / path colours, ponds [{ a, r, rad }], beds.
export const PLANS = {
  // wave6-Q (judges, wave5 biome trials): ~3x the cards, layered by distance from the walk (low edging -> mid shrubs ->
  // tall planting -> the wall), allowed to overlap like stacked pop-up layers; `pd` = [min, max] distance (units) from
  // the walk EDGE a fill card may stand at, `pack` = how close cards may crowd (x the sum of their radii; hero 0.7).
  desert: {
    seed: 11,
    hero: [
      { s: 'int_euphorbia', h: 2.5, a: 235, r: 1.05 }, // tree-sized candelabra euphorbia on the central rock island
      // pale salmon-tan sandstone spires, several taller than the traveller (photos 15, 20, 22)
      { s: 'int_sand_spire_pale', h: 3.7, a: 345, r: 3.5 },
      { s: 'int_sand_spire_pale', h: 3.1, a: 20, r: 3.9 },
      { s: 'int_sand_spire_pale', h: 2.8, a: 300, r: 3.7 },
      { s: 'int_sand_spire_pale', h: 2.3, a: 65, r: 3.8 },
      { s: 'int_sand_ledge', h: 0.45, a: 0, r: 2.6 },
      { s: 'int_sand_ledge', h: 0.4, a: 140, r: 3.4 },
      // fan palms, some blue-grey with shaggy skirts (photos 19, 30)
      { s: 'int_blue_fan_palm', h: 4.6, a: 330, r: 1.9, cross: true },
      { s: 'int_blue_fan_palm', h: 3.9, a: 40, r: 2.9, cross: true },
      { s: 'int_fan_palm', h: 3.6, a: 285, r: 3.1, cross: true },
      { s: 'int_tree_aloe', h: 2.0, a: 310, r: 2.4 }, // photo 29: the tree aloe by the pond
      { s: 'int_column_cactus', h: 2.8, a: 55, r: 2.3 },
      { s: 'int_column_cactus', h: 2.3, a: 270, r: 3.3 },
      { s: 'bench_0', h: 0.34, a: 105, r: 1.55 }, // photo 19: a bench against the rockwork, by the path
    ],
    fill: [
      // back: tall unbranched columns, spires, euphorbias against the glass
      { s: ['int_column_cactus', 'int_column_cactus', 'int_organ_cactus', 'int_sand_spire_pale', 'int_euphorbia', 'int_tree_aloe', 'int_euphorbia'], h: [1.6, 2.7], n: 16, r: [2.6, 4.9], arc: [250, 110], pd: [0.45, 9] },
      // mid: aloes, yellow-flowering bushes, agaves, prickly pear
      { s: ['int_yellow_bush', 'int_yellow_bush', 'int_tree_aloe', 'int_agave', 'prickly_pear_0', 'int_column_cactus', 'int_orn_grass'], h: [0.7, 1.3], n: 34, r: [1.0, 4.9], arc: [0, 360], pd: [0.2, 9] },
      // walk edging: agaves, barrels, grasses, flowers
      { s: ['int_agave', 'barrel_cactus_0', 'barrel_cactus_1', 'desert_flowers_0', 'desert_flowers_1', 'int_orn_grass', 'int_yellow_bush'], h: [0.3, 0.55], n: 52, r: [0.6, 4.9], arc: [0, 360], pd: [0, 0.45], pack: 0.45 },
      { s: ['int_sand_ledge'], h: [0.3, 0.45], n: 6, r: [2.8, 4.9], arc: [90, 270] },
    ],
    floor: {
      ground: '#d3a784', grain: '#bf9070', path: '#e8c6a8', pathEdge: '#ad7c60',
      ponds: [{ u: -0.68, v: 0.5, rad: 0.45, water: '#4f8f86', rim: '#cfa080' }], // photo 29: a small pool in the rockwork
      rocks: '#dcb08e',
      cover: ['#b99a6a', '#9c9a6a', '#c8a27c', '#a7a26e'], // gravel + low succulent mats
    },
  },
  show: {
    seed: 23,
    hero: [
      { s: 'int_gazebo_white', h: 1.9, a: 32, r: 2.05 }, // photo 28 + plan 01: white gazebo, dark shingle roof
      { s: 'int_conifer', h: 5.0, a: 330, r: 3.0 }, // photos 16, 17: one tall dominant conifer
      { s: 'int_pergola', h: 1.5, a: 62, r: 2.5 }, // photo 16: the plain white lattice pergola
      { s: 'int_red_shrub', h: 1.2, a: 290, r: 2.6 }, // photo 16: round red-flowering shrubs
      { s: 'int_red_shrub', h: 1.0, a: 80, r: 3.6 },
      { s: 'int_stone_wall', h: 0.32, a: 15, r: 2.75 }, // photo 17: the low stone retaining wall by the gazebo
      { s: 'int_metal_bench', h: 0.42, a: 150, r: 2.75 }, // photo 17: dark metal benches beside the walk
      { s: 'int_metal_bench', h: 0.42, a: 215, r: 2.75 },
      { s: 'mountains_rocks_6', h: 0.55, a: 255, r: 1.65 }, // reeds at the pond edge (photo 28)
      { s: 'mountains_rocks_7', h: 0.5, a: 120, r: 1.75 },
    ],
    fill: [
      // massed drifts wrapping the pond (photo 28: magenta / pink / purple / red)
      { s: ['int_drift_rose', 'int_drift_purple'], h: [0.26, 0.36], n: 22, r: [1.35, 3.0], arc: [0, 360], pack: 0.35 },
      // walk edging: coleus, bedding, grasses
      { s: ['int_coleus', 'int_drift_rose', 'int_drift_purple', 'flower_bed_1', 'int_orn_grass', 'int_coleus'], h: [0.28, 0.5], n: 46, r: [1.3, 4.9], arc: [0, 360], pd: [0, 0.5], pack: 0.4 },
      // mid: red shrubs, ornamental grass, bushes, coloured leaves
      { s: ['int_red_shrub', 'int_orn_grass', 'bushes_0', 'bushes_3', 'int_coleus', 'int_red_shrub'], h: [0.55, 1.1], n: 28, r: [1.4, 4.9], arc: [0, 360], pd: [0.25, 9] },
      // back: evergreens and big shrubs against the glass
      { s: ['trees_b_0', 'trees_b_1', 'int_red_shrub', 'bushes_3', 'trees_b_3'], h: [1.3, 2.6], n: 12, r: [3.2, 4.9], arc: [250, 110], pd: [0.4, 9] },
    ],
    floor: {
      ground: '#7f9a52', grain: '#6d8746', path: '#e6cfa6', pathEdge: '#b49466',
      ponds: [{ u: -0.05, v: -0.08, rad: 1.35, water: '#5fa6a0', rim: '#a9a196', lilies: true }], // photo 28 + plan 01: the pond inside the loop
      beds: ['#b8335a', '#d9566b', '#8a3f9a', '#c43a3a', '#e07a9a'],
      cover: ['#5f7e3e', '#6f8f45', '#8a3f6a', '#a8405a', '#56733a'],
    },
  },
  tropical: {
    seed: 37,
    // doors at bearings 313 (lobby) and 0 (Desert link): the back is split by a walkway, so the tall planting stands
    // either side of it (NE and W) and in the wedge between the two walks. wave6-Q: canopy up toward the apex
    hero: [
      { s: 'int_tall_palm_lit', h: 6.4, a: 20, r: 0.9, cross: true }, // a full slender palm crown under the skylight
      { s: 'int_fan_palm', h: 5.6, a: 50, r: 1.6, cross: true }, // photo 31: a fan palm reaching the apex
      { s: 'int_tall_palm_lit', h: 5.4, a: 280, r: 1.9, cross: true },
      { s: 'int_tall_palm', h: 4.8, a: 336, r: 2.8, cross: true },
      { s: 'int_canopy_lit', h: 4.6, a: 40, r: 2.9, cross: true }, // photos 24-26: dense broadleaf canopy
      { s: 'int_canopy_lit', h: 4.4, a: 268, r: 2.9, cross: true },
      { s: 'int_canopy_tree', h: 4.0, a: 88, r: 3.1, cross: true },
      { s: 'int_canopy_lit', h: 3.8, a: 336, r: 3.6, cross: true },
      { s: 'int_feather_palm', h: 4.2, a: 300, r: 3.2, cross: true }, // fine feathery-leaved trees
      { s: 'int_feather_palm', h: 3.8, a: 70, r: 3.8, cross: true },
      { s: 'int_banana_lit', h: 2.4, a: 65, r: 2.7 },
      { s: 'int_banana_lit', h: 2.1, a: 245, r: 2.6 },
      { s: 'int_tree_fern', h: 1.9, a: 110, r: 2.6 },
    ],
    fill: [
      // canopy: tall broadleaf / feathery trees and palms ringing the glass
      { s: ['int_canopy_lit', 'int_canopy_tree', 'int_feather_palm', 'int_tall_palm_lit', 'int_canopy_lit'], h: [3.0, 4.6], n: 14, r: [2.2, 4.9], arc: [230, 130], cross: true, pd: [0.3, 9], pack: 0.4 },
      // mid: banana / cane strap-leaved clumps, tree ferns
      { s: ['int_banana_lit', 'int_strap_clump', 'int_strap_clump', 'int_tree_fern', 'int_banana', 'int_feather_palm'], h: [1.4, 2.5], n: 26, r: [1.0, 4.9], arc: [220, 140], pd: [0.25, 9] },
      { s: ['int_strap_clump', 'int_banana_lit', 'int_tree_fern'], h: [0.9, 1.5], n: 8, r: [1.0, 4.9], arc: [140, 220], pd: [0.25, 9] },
      // understory: monstera, elephant ears, ferns right to the walk edge
      { s: ['int_monstera_lit', 'int_elephant_lit', 'int_monstera', 'fern_0', 'fern_1', 'int_strap_clump', 'int_elephant_lit'], h: [0.45, 1.0], n: 60, r: [0.5, 4.9], arc: [0, 360], pd: [0, 0.6], pack: 0.4 },
    ],
    floor: {
      ground: '#3f4d2a', grain: '#323e22', path: '#cdb48a', pathEdge: '#8a7550',
      ponds: [],
      litter: ['#5f7a33', '#2f3b20', '#6d6a3a'],
      cover: ['#4f7a2c', '#3d6626', '#5f8a30', '#2f4d22', '#6a9a34'],
    },
  },
};

/**
 * Resolve a plan into card placements: [{ s, h, x, z, cross, i }], dome-local units. `atlas` = atlas.json (aspects).
 * Heights are clamped under the glass (headroom at the card's outer corner, x 0.92); props in a walkway are nudged
 * along their bearing ring (hero) or rejected (fill).
 */
export function layout(id, atlas) {
  const plan = PLANS[id]; const net = network(id); const ponds = pondsOf(id); const rand = rng(plan.seed);
  const out = [];
  const halfW = (s, h) => (h * (atlas.sprites[s] ? atlas.sprites[s].aspect : 1)) / 2;
  const fits = (s, h, x, z) => {
    const rho = Math.hypot(x, z) + halfW(s, h);
    if (rho > MAX_R) return 0;
    return Math.min(h, headroom(rho) * 0.92);
  };
  const free = (x, z, rad, pack = 0.7) => isClear(x, z, rad, net, ponds) && out.every((p) => Math.hypot(p.x - x, p.z - z) > (p.rad + rad) * pack);
  const edge = (x, z) => pathDistance(net, x, z) - PATH_HALF; // distance from the walk edge
  for (const k of plan.hero) {
    if (!atlas.sprites[k.s]) continue;
    // nearest free spot to the authored one: rings of +-0.35 u, bearings +-8 deg steps up to +-48 deg
    search: for (const dr of [0, -0.35, 0.35, -0.7, 0.7, -1.05, 1.05]) {
      for (let j = 0; j < 13; j++) {
        const da = (j & 1 ? 1 : -1) * Math.ceil(j / 2) * 8;
        const [x, z] = pol(k.a + da, k.r + dr);
        const rad = Math.min(halfW(k.s, k.h), 0.9) * 0.6;
        const h = fits(k.s, k.h, x, z);
        if (h > k.h * 0.75 && free(x, z, rad)) { out.push({ s: k.s, h, x, z, cross: !!k.cross, rad }); break search; }
      }
    }
  }
  for (const g of plan.fill) {
    const span = ((g.arc[1] - g.arc[0] + 360) % 360) || 360;
    let placed = 0;
    const [pd0, pd1] = g.pd || [0, Infinity];
    for (let tries = 0; placed < g.n && tries < g.n * 60; tries++) {
      const s = g.s[Math.floor(rand() * g.s.length)];
      if (!atlas.sprites[s]) continue;
      const a = g.arc[0] + rand() * span;
      const r = Math.sqrt(g.r[0] ** 2 + rand() * (g.r[1] ** 2 - g.r[0] ** 2));
      const [x, z] = pol(a, r);
      const want = g.h[0] + rand() * (g.h[1] - g.h[0]);
      const h = fits(s, want, x, z);
      const rad = Math.min(halfW(s, want), 0.9) * 0.6;
      if (h < want * 0.7 || !free(x, z, rad, g.pack ?? 0.55)) continue;
      const e = edge(x, z);
      if (e < pd0 || e > pd1) continue;
      out.push({ s, h, x, z, cross: !!g.cross, rad });
      placed++;
    }
  }
  return out.map((p, i) => ({ ...p, i }));
}

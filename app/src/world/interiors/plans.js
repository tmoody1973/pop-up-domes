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
// fill: { s: [sprites], h: [min, max], n, r: [r0, r1], arc: [a0, a1] (clockwise from a0), cross? } scattered with a
//       fixed seed, rejected on walkways, the plaza and each other.
// floor: the printed ground (index.js draws it): ground / path colours, ponds [{ a, r, rad }], beds.
export const PLANS = {
  desert: {
    seed: 11,
    hero: [
      { s: 'int_red_spire', h: 2.3, a: 345, r: 3.4 },
      { s: 'int_red_spire', h: 1.8, a: 20, r: 3.9 },
      { s: 'int_red_outcrop', h: 0.75, a: 0, r: 2.6 },
      { s: 'int_red_spire', h: 1.6, a: 300, r: 3.6 },
      { s: 'int_red_outcrop', h: 0.6, a: 75, r: 3.4 },
      { s: 'int_red_outcrop', h: 0.55, a: 140, r: 3.3 },
      { s: 'int_fan_palm', h: 4.4, a: 330, r: 1.9, cross: true },
      { s: 'int_fan_palm', h: 3.6, a: 40, r: 2.9, cross: true },
      { s: 'int_tree_aloe', h: 1.7, a: 310, r: 2.2 }, // photo 29: the tree aloe by the pond
      { s: 'int_organ_cactus', h: 2.2, a: 15, r: 2.1 },
      { s: 'cactus_0', h: 2.4, a: 55, r: 2.3 },
      { s: 'bench_0', h: 0.34, a: 105, r: 1.55 }, // photo 19: a bench against the rockwork, by the path
    ],
    fill: [
      { s: ['cactus_0', 'cactus_1', 'int_organ_cactus', 'int_tree_aloe'], h: [1.3, 2.0], n: 7, r: [2.0, 4.6], arc: [280, 90] },
      { s: ['int_agave'], h: [0.45, 0.7], n: 8, r: [1.3, 4.6], arc: [0, 360] },
      { s: ['barrel_cactus_0', 'barrel_cactus_1'], h: [0.32, 0.42], n: 7, r: [1.2, 4.2], arc: [0, 360] },
      { s: ['prickly_pear_0', 'int_tree_aloe'], h: [0.7, 1.1], n: 4, r: [2.0, 4.4], arc: [60, 300] },
      { s: ['desert_flowers_0', 'desert_flowers_1', 'thorn_bush_0'], h: [0.3, 0.45], n: 7, r: [1.1, 4.0], arc: [90, 270] },
      { s: ['int_red_outcrop'], h: [0.35, 0.5], n: 4, r: [3.0, 4.8], arc: [90, 270] },
    ],
    floor: {
      ground: '#c9916b', grain: '#b57a58', path: '#e2b99a', pathEdge: '#a8694c',
      ponds: [{ u: -0.68, v: 0.5, rad: 0.45, water: '#4f8f86', rim: '#b0644a' }], // photo 29: a small pool in the rockwork
      rocks: '#b4563e',
    },
  },
  show: {
    seed: 23,
    hero: [
      { s: 'gazebo_0', h: 1.75, a: 32, r: 2.05 }, // photo 28 + plan 01: gazebo behind the pond, at the end of the west spur
      { s: 'trees_b_0', h: 3.4, a: 325, r: 3.4, cross: true }, // photos 16, 17: tall evergreens
      { s: 'trees_b_3', h: 3.0, a: 30, r: 3.6, cross: true },
      { s: 'blossom_tree_white_0', h: 1.9, a: 290, r: 2.6, cross: true },
      { s: 'wisteria_arch_0', h: 1.15, a: 60, r: 2.4 }, // photo 16: the white pergola arch
      { s: 'bench_0', h: 0.34, a: 150, r: 2.75 }, // photo 17: benches beside the walk, inside the loop
      { s: 'bench_0', h: 0.34, a: 215, r: 2.75 },
      { s: 'mountains_rocks_6', h: 0.55, a: 255, r: 1.65 }, // reeds at the pond edge (photo 28)
      { s: 'mountains_rocks_7', h: 0.5, a: 120, r: 1.75 },
    ],
    fill: [
      { s: ['flower_bed_0', 'flower_bed_1'], h: [0.38, 0.48], n: 12, r: [1.3, 4.6], arc: [0, 360] },
      { s: ['bushes_0', 'bushes_3', 'bushes_0', 'blossom_tree_0'], h: [0.5, 1.0], n: 6, r: [2.8, 4.8], arc: [270, 100] },
      { s: ['fern_0', 'fern_1', 'bushes_0'], h: [0.35, 0.5], n: 6, r: [1.4, 4.4], arc: [100, 260] },
    ],
    floor: {
      ground: '#9fae6a', grain: '#8a9a5a', path: '#e6cfa6', pathEdge: '#b49466',
      ponds: [{ u: -0.05, v: -0.08, rad: 1.35, water: '#5fa6a0', rim: '#c9bba0', lilies: true }], // photo 28 + plan 01: the pond inside the loop
      beds: ['#d9566b', '#f0b54a', '#c06bb0', '#f1e9d6', '#e07a3a'],
    },
  },
  tropical: {
    seed: 37,
    // doors at bearings 313 (lobby) and 0 (Desert link): the back is split by a walkway, so the tall planting stands
    // either side of it (NE and W) and in the wedge between the two walks
    hero: [
      { s: 'int_fan_palm', h: 5.6, a: 50, r: 1.5, cross: true }, // photo 31: a fan palm reaching the apex
      { s: 'int_tall_palm', h: 5.0, a: 280, r: 1.9, cross: true },
      { s: 'int_tall_palm', h: 4.3, a: 336, r: 2.8, cross: true },
      { s: 'int_canopy_tree', h: 3.8, a: 40, r: 2.9, cross: true }, // photos 24-26: dense broadleaf canopy
      { s: 'int_canopy_tree', h: 3.5, a: 268, r: 2.9, cross: true },
      { s: 'int_canopy_tree', h: 3.2, a: 88, r: 3.1, cross: true },
      { s: 'int_canopy_tree', h: 2.8, a: 336, r: 3.4, cross: true },
      { s: 'int_banana', h: 2.2, a: 65, r: 2.7 },
      { s: 'int_banana', h: 1.9, a: 245, r: 2.6 },
      { s: 'int_tree_fern', h: 1.8, a: 110, r: 2.6 },
    ],
    fill: [
      { s: ['int_canopy_tree', 'int_tall_palm'], h: [2.4, 3.2], n: 3, r: [2.6, 3.6], arc: [200, 120], cross: true },
      { s: ['int_banana', 'int_tree_fern', 'palm_0', 'palm_1'], h: [1.4, 2.2], n: 7, r: [2.2, 4.6], arc: [250, 120] },
      { s: ['int_monstera', 'int_elephant_ear', 'int_monstera'], h: [0.6, 1.0], n: 14, r: [1.3, 4.7], arc: [0, 360] },
      { s: ['fern_0', 'fern_1', 'bushes_0'], h: [0.35, 0.55], n: 10, r: [1.2, 4.5], arc: [0, 360] },
    ],
    floor: {
      ground: '#5f6b3f', grain: '#4c5733', path: '#cdb48a', pathEdge: '#8a7550',
      ponds: [],
      litter: ['#7b8a4a', '#3f4a2a', '#8d7a4a'],
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
  const free = (x, z, rad) => isClear(x, z, rad, net, ponds) && out.every((p) => Math.hypot(p.x - x, p.z - z) > (p.rad + rad) * 0.7);
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
    for (let tries = 0; placed < g.n && tries < g.n * 40; tries++) {
      const s = g.s[Math.floor(rand() * g.s.length)];
      if (!atlas.sprites[s]) continue;
      const a = g.arc[0] + rand() * span;
      const r = Math.sqrt(g.r[0] ** 2 + rand() * (g.r[1] ** 2 - g.r[0] ** 2));
      const [x, z] = pol(a, r);
      const want = g.h[0] + rand() * (g.h[1] - g.h[0]);
      const h = fits(s, want, x, z);
      const rad = Math.min(halfW(s, want), 0.9) * 0.6;
      if (h < want * 0.7 || !free(x, z, rad)) continue;
      out.push({ s, h, x, z, cross: !!g.cross, rad });
      placed++;
    }
  }
  return out.map((p, i) => ({ ...p, i }));
}

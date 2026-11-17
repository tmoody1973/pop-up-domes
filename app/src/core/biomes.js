// Contract (was FROZEN, unfrozen by wave1-A, see LOG.md): which BIOME a cell belongs to. Pure, deterministic,
// allocation-free lookups shared by the world, weather / ambient life and the grade. Function names and signatures
// are unchanged so callers are untouched; `seed` is ignored.
//
// Layout (Domes): a lookup into the site map's regions (world/sitemap.js): each dome's circular footprint carries
// that dome's biome (Show -> blossom, Desert -> desert, Tropical -> heartland until a `tropical` biome exists); the
// lawn, lobby, paths and everything else are heartland. Distances are measured to the footprint circles, so the
// soft weights and `edge` agree with the cell biomes at every spot.

import { DOMES } from '../world/sitemap.js';

export const BIOMES = ['heartland', 'desert', 'snow', 'blossom', 'pinewood'];
export const BIOME_INDEX = { heartland: 0, desert: 1, snow: 2, blossom: 3, pinewood: 4 };

const H = BIOME_INDEX.heartland;
const _d = new Float64Array(BIOMES.length); // distance (tiles) from the point to the nearest region of each biome (scratch)

/** Fills _d: 0 inside a region of that biome, else the distance to its nearest footprint edge. x, z in TILE units. */
function distances(x, z) {
  for (let i = 0; i < _d.length; i++) _d[i] = 1e9;
  let inside = -1; // dome whose footprint holds the point
  for (let k = 0; k < DOMES.length; k++) {
    const d = DOMES[k];
    const s = Math.sqrt((x - d.cx) * (x - d.cx) + (z - d.cz) * (z - d.cz)) - d.rt; // < 0 inside
    const b = BIOME_INDEX[d.biome];
    if (s <= 0) { inside = k; _d[b] = 0; if (b !== H) _d[H] = Math.min(_d[H], -s); } else if (s < _d[b]) _d[b] = s;
  }
  if (inside < 0) _d[H] = 0; // the grounds
}

function nearest() {
  let best = 0;
  for (let i = 1; i < _d.length; i++) if (_d[i] < _d[best]) best = i;
  return best;
}

/** Biome index (into BIOMES) of the cell / tile-space point. */
export function biomeIndexAt(seed, cx, cz) {
  distances(cx, cz);
  return nearest();
}

/** Biome id ('heartland' | 'desert' | ...) of cell (cx, cz). */
export function biomeAt(seed, cx, cz) { return BIOMES[biomeIndexAt(seed, cx, cz)]; }

/**
 * Biome + how deep inside it the point is.
 * @returns {{ id: string, index: number, edge: number }} edge = approx. distance (tiles) to the nearest other biome.
 *          The SAME object is returned on every call (copy the fields you keep).
 */
const _info = { id: 'heartland', index: 0, edge: 0 };
export function biomeInfo(seed, cx, cz) {
  distances(cx, cz);
  const best = nearest();
  let second = 1e9;
  for (let i = 0; i < _d.length; i++) if (i !== best && _d[i] < second) second = _d[i];
  _info.id = BIOMES[best]; _info.index = best; _info.edge = second - _d[best];
  return _info;
}

/**
 * Smooth blend weights (sum = 1) of every biome around a point, for weather / light / sound cross-fades.
 * @param {number} x tile-space X (world x / TILE_SIZE)  @param {number} z tile-space Z
 * @param {Float32Array|number[]} out length BIOMES.length  @param {number} [soft=1.6] blend half-width in tiles
 */
export function biomeWeights(seed, x, z, out, soft = 1.6) {
  distances(x, z);
  let sum = 0;
  for (let i = 0; i < _d.length; i++) { const w = _d[i] >= 1e9 ? 0 : Math.exp(-_d[i] / soft); out[i] = w; sum += w; }
  for (let i = 0; i < _d.length; i++) out[i] /= sum;
  return out;
}

/** Nearest cell (spiral from cx, cz) that lies at least `depth` tiles inside biome `id`. Returns {x, z} (cell) or null. */
export function findBiome(seed, id, cx = 0, cz = 0, depth = 3, maxR = 90) {
  const want = BIOME_INDEX[id];
  if (want === undefined) return null;
  for (let r = 0; r <= maxR; r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const info = biomeInfo(seed, cx + dx, cz + dz);
        if (info.index === want && info.edge >= depth) return { x: cx + dx, z: cz + dz };
      }
    }
  }
  return null;
}

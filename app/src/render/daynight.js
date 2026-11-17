// Day / dusk / night look. The single writer of the look tunables in CONFIG (lights + post read them every frame):
// biome grade first (render/biomegrade.js, blended by biomeWeights around the traveller), the time of day on top.
// The blend runs 0 = day, 0.5 = dusk (biomegrade DUSK_BASE), 1 = night; each step eases over STEP_S seconds.
// Also drives the window / lantern / dome-pane / halo glow.
import { CONFIG } from '../core/config.js';
import { state } from '../core/state.js';
import { createBiomeGrade } from './biomegrade.js';

const MODES = ['day', 'dusk', 'night'];
const STEP_S = 1.6; // seconds per change of mode
// ponytail: the glow list is a scene traverse every RESCAN_S (props added later register themselves by being in the
// scene with a non-black emissive). Ceiling: a scene of ~10k nodes; past that, have props call a register hook.
const RESCAN_S = 0.5;

const isGlow = (m) => m.emissive && m.emissiveIntensity > 0 && m.emissive.getHex() !== 0;

export function createDayNight({ scene, night = false, dusk = false }) {
  const grade = createBiomeGrade();
  let mode = night ? 2 : dusk ? 1 : 0;
  let from = mode / 2;
  let to = from;
  let p = 1;
  const glow = new Set();
  let glowApplied = -1;
  let rescanIn = 0;

  function rescan(g) {
    scene.traverse((o) => {
      for (const m of (Array.isArray(o.material) ? o.material : o.material ? [o.material] : [])) {
        if (!glow.has(m) && isGlow(m)) { glow.add(m); m.emissiveIntensity = g; }
      }
    });
  }

  function applyGlow(dt) {
    const g = CONFIG.assets.glowIntensity;
    rescanIn -= dt;
    if (rescanIn <= 0) { rescanIn = RESCAN_S; rescan(g); }
    if (g === glowApplied) return;
    glowApplied = g;
    for (const m of glow) m.emissiveIntensity = g;
  }

  function go(m, snap) {
    const eNow = from + (to - from) * (p * p * (3 - 2 * p));
    mode = m;
    from = snap ? m / 2 : eNow;
    to = m / 2;
    p = snap ? 1 : 0;
    return MODES[mode];
  }

  return {
    get night() { return mode === 2; },
    get dusk() { return mode === 1; },
    /** 'day' | 'dusk' | 'night' (the target, not the current blend). */
    get mode() { return MODES[mode]; },
    /** The biome grade (weights, force(id)) for debugging: __interiors.daynight.grade.force('snow'). */
    grade,
    /** N key: day -> dusk -> night -> day. Returns true at night (old toggle contract). */
    toggle() { go((mode + 1) % 3); return mode === 2; },
    /** set(true|false) = night / day (old contract), or set('day'|'dusk'|'night'). */
    set(n, snap = false) { go(typeof n === 'string' ? Math.max(0, MODES.indexOf(n)) : n ? 2 : 0, snap); },
    /** The glow list (live Set) for debugging: [...__interiors.daynight.glow]. */
    get glow() { return glow; },
    update(dt) {
      if (p < 1) p = Math.min(1, p + dt / STEP_S);
      const e = from + (to - from) * (p * p * (3 - 2 * p));
      const t = state.traveller;
      const ts = CONFIG.TILE_SIZE || 2;
      grade.update(dt, state.seed, t.x / ts, t.z / ts, e);
      applyGlow(dt);
    },
  };
}

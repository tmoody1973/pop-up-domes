// Mitchell Park dome shell as hinged cardstock flaps (docs/ARCHITECTURE.md §1, §4.B, §5). Pure three.js: no DOM,
// so the fidelity / fold-feel checks can import it in Node.
//
// Shape: BUILD-NOTES §2 profile table -> CatmullRom (r, u) curve -> N gores. Each gore is a GENERAL CYLINDER strip over
// the profile (flat across its width, curved along its length): a real developable paper gore. Its seams lie exactly
// on the profile radius; its centre line sits at r cos(pi/N) (N = 16: -1.9 %, the "flat gore" loss).
// Each gore is cut into TIER cards along u, nested parent -> child (fold.js NESTED regime) and folded as an accordion:
// tier 1 folds inward onto the page, tier 2 back over it, tier 3 inward again ... so the folded dome is a stack of
// cards inside its own footprint. The ribbed apex cap is the deepest child (rises last). A saw-tooth louvred base
// ring (one card per gore) stands just outside the glass and folds inward over the stack.
//
// Frames: a gore Group has +Z = radial outward, +Y = up, so +X = Y x Z = the hinge axis of every tier (all tiers of
// one gore turn about parallel axes, so the fold maths is 2-D in the gore's meridian plane). Card local frame per
// ARCHITECTURE §1.2: X = hinge, +Y = up the card (chord), +Z = printed outer face.
import * as THREE from 'three';
import { TILE_SIZE, FLAP_LAYER_GAP } from '../../core/config.js';
import { SITE, ftToWorld } from '../sitemap.js';

// ---- subject (BUILD-NOTES §1-3; feet) -------------------------------------------------------------------------------
/** BUILD-NOTES §2: [u = y / 85 ft, r = radius / 70 ft]. */
export const PROFILE = Object.freeze([
  [0.00, 0.93], [0.10, 0.96], [0.20, 0.985], [0.30, 1.00], [0.41, 1.00], [0.50, 0.91], [0.55, 0.88], [0.60, 0.85],
  [0.65, 0.79], [0.70, 0.70], [0.75, 0.62], [0.80, 0.56], [0.85, 0.46], [0.90, 0.37], [0.95, 0.19], [1.00, 0.00],
]);
const R_FT = 70; const H_FT = 85;
/** World units per foot: SITE.ftPerTile ft per tile, TILE_SIZE units per tile (24 ft / 2 = 12 ft per unit). */
export const UNIT_FT = SITE.ftPerTile / TILE_SIZE;
export const R = R_FT / UNIT_FT; // 5.833
export const H = H_FT / UNIT_FT; // 7.083
/** Glass stops here; the opaque cap closes it (BUILD-NOTES §2: "stop the glass at about u = 0.985"). */
export const U_TOP = 0.985;

// ---- build parameters -----------------------------------------------------------------------------------------------
/** Gores: a flat gore's centre line sits at cos(pi/N) of the radius. 16 -> 1.92 % (target < 3 %). */
export const N_GORES = 16;
/** Fold-tier boundaries in u: every other ring of the BUILD-NOTES §3 ring layout, so tier cards line up with the print
 * zones (hex 0-.27, diamond .27-.55, triangle .55-.83, ring beam + closing .83-.985). */
export const TIERS_U = Object.freeze([0, 0.13, 0.27, 0.41, 0.55, 0.69, 0.83, 0.94, U_TOP]);
/** BUILD-NOTES §3 ring layout (print rows). */
export const RINGS_U = Object.freeze([0, 0.06, 0.13, 0.20, 0.27, 0.34, 0.41, 0.48, 0.55, 0.62, 0.69, 0.76, 0.83, 0.89, 0.94, 0.98]);
/** Dome card thickness and the accordion step (card + air gap). Thinner than the 0.016 tile cards: 8 tiers stack. */
export const CARD_T = 0.012;
export const STEP = (CARD_T + 0.002) / 2; // folded separation = 2 x STEP (see buildDome)
/** Cap: a low ribbed drum, ~8-10 ft across (BUILD-NOTES §2). */
export const CAP_T = 0.07;
/** Base ring (photo 01-exterior/04): saw-tooth wall, valleys ~4.5 % and peaks ~10 % of the height; fieldstone plinth. */
export const RING = Object.freeze({ valley: 0.045, peak: 0.10, plinth: 0.035, teeth: 2, out: 0.03 });
/** Fold choreography: seconds over which one instance's delays 0..1 are spread (fold.js info.staggerSpan). */
export const STAGGER_SPAN = 1.15;
/** Feel knobs (ARCHITECTURE §5.2: big set-piece flaps need sway 0; stiffness tunes their speed). Calibrated with
 * the fold-feel check (LOG.md [wave2-D]). */
export const FEEL = Object.freeze({ stiffness: 0.8, wobble: 0.7 });
/** Cutaway sector: gores whose centre is within this angle of the camera side (+Z, follow yaw 0) -> 5 of 16. */
export const SECTOR_HALF_DEG = 50;
/** [wave4-J] Doorways: clear width at the ring (= collide.js DOME_DOOR_W, jamb faces 1.0 u = 12 ft apart) and head
 * height (10 ft). The opening is a notch in the gore's lowest tier card (a ~1 ft lintel stays: the card is one piece)
 * plus a gap in that gore's base-ring card. */
export const DOOR_W = 1.0;
/** Minimum card left between a door notch and its gore's seam (u), so seams stay whole. */
const DOOR_SEAM_MARGIN = 0.04;
export const DOOR_TOP_FT = 10;
const DOOR_U = DOOR_TOP_FT / UNIT_FT / H; // 0.118 (tier 1 ends at u = 0.13)

// ---- profile curve ----------------------------------------------------------------------------------------------------
const curve = new THREE.CatmullRomCurve3(PROFILE.map(([u, r]) => new THREE.Vector3(r, u, 0)), false, 'centripetal');
const SAMPLES = curve.getPoints(1024).map((p) => [p.y, p.x]); // [u, r], u increasing

/** Normalised radius r(u) on the CatmullRom curve (linear between 1025 dense samples). */
export function rAt(u) {
  let lo = 0; let hi = SAMPLES.length - 1;
  if (u <= SAMPLES[0][0]) return SAMPLES[0][1];
  if (u >= SAMPLES[hi][0]) return SAMPLES[hi][1];
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (SAMPLES[m][0] <= u) lo = m; else hi = m; }
  const [u0, r0] = SAMPLES[lo]; const [u1, r1] = SAMPLES[hi];
  return r0 + ((r1 - r0) * (u - u0)) / Math.max(1e-9, u1 - u0);
}

const COS = Math.cos(Math.PI / N_GORES); const SIN = Math.sin(Math.PI / N_GORES);

/** Meridian rows of one gore: centre line (rho, y), seam half-width hw, developed length sigma, outward normal. */
function buildRows() {
  const us = new Set();
  for (let i = 0; i <= 60; i++) us.add(+(U_TOP * i / 60).toFixed(5)); // + table rows + tier / ring boundaries below
  for (const [u] of PROFILE) if (u <= U_TOP) us.add(u);
  for (const u of TIERS_U) us.add(u);
  for (const u of RINGS_U) if (u <= U_TOP) us.add(u);
  us.add(DOOR_U); // a row exactly at the door head, so the notch is cut on a row
  const list = [...us].sort((a, b) => a - b);
  const rows = list.map((u) => { const r = rAt(u) * R; return { u, rho: r * COS, y: u * H, hw: r * SIN, sigma: 0, nr: 1, ny: 0 }; });
  for (let i = 1; i < rows.length; i++) rows[i].sigma = rows[i - 1].sigma + Math.hypot(rows[i].rho - rows[i - 1].rho, rows[i].y - rows[i - 1].y);
  for (let i = 0; i < rows.length; i++) {
    const a = rows[Math.max(0, i - 1)]; const b = rows[Math.min(rows.length - 1, i + 1)];
    const tr = b.rho - a.rho; const ty = b.y - a.y; const l = Math.hypot(tr, ty) || 1;
    rows[i].nr = ty / l; rows[i].ny = -tr / l; // tangent rotated -90 deg: outward
  }
  return rows;
}
export const ROWS = Object.freeze(buildRows());
const rowAt = (u) => ROWS.find((r) => Math.abs(r.u - u) < 1e-6);

// ---- texture layout (shared with print.js) ------------------------------------------------------------------------------
export const LAYOUT = (() => {
  const CW = 1024; const CH = 2048;
  const sigmaTop = ROWS[ROWS.length - 1].sigma;
  const PX = Math.min(180, (CH - 48) / sigmaTop);
  const ringR = rAt(RING.peak) * R * COS + RING.out; // in front of the glass foot up to the tooth peaks
  const ringW = 2 * ringR * Math.tan(Math.PI / N_GORES);
  const capR = rAt(U_TOP) * R + 0.03;
  return Object.freeze({
    CW, CH, PX,
    gore: { x: 256, y0: CH - 24 }, // canvas px of (w = 0, sigma = 0)
    ring: { x: 544, y: 40, w: ringW, h: RING.peak * H, r: ringR },
    cap: { x: 784, y: 520, r: capR },
    white: { x: 1008, y: 1008 },
  });
})();
const uvOf = (px, py) => [px / LAYOUT.CW, 1 - py / LAYOUT.CH]; // CanvasTexture flipY = true
const goreUv = (w, sigma) => uvOf(LAYOUT.gore.x + w * LAYOUT.PX, LAYOUT.gore.y0 - sigma * LAYOUT.PX);
const WHITE_UV = uvOf(LAYOUT.white.x, LAYOUT.white.y);

// ---- geometry ----------------------------------------------------------------------------------------------------------------
/** Collects an indexed slab: position, normal, uv, uv1 (-1 = no atlas art, materials.js), color. */
function mesher() {
  const P = []; const N = []; const U = []; const C = []; const I = [];
  return {
    v(x, y, z, nx, ny, nz, uv, c) { P.push(x, y, z); N.push(nx, ny, nz); U.push(uv[0], uv[1]); C.push(c, c, c); return P.length / 3 - 1; },
    quad(a, b, c, d) { I.push(a, b, c, a, c, d); },
    tri(a, b, c) { I.push(a, b, c); },
    pos(i) { return [P[3 * i], P[3 * i + 1], P[3 * i + 2]]; },
    done() {
      const g = new THREE.BufferGeometry();
      const n = P.length / 3;
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
      g.setAttribute('uv1', new THREE.Float32BufferAttribute(new Float32Array(n * 2).fill(-1), 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
      g.setIndex(I);
      g.computeBoundingBox(); g.computeBoundingSphere();
      return g;
    },
  };
}

const EDGE = 0.9; // cream cut edge (ARCHITECTURE §2.3)

/**
 * One tier card of a gore, in its own hinge frame. Also returns the chord (for the fold maths).
 * door = { x0, x1 } (card X, x0 < x1): cut a doorway notch from the bottom edge up to the DOOR_U row. The card stays
 * one piece (two legs + the strip above the door head), so it folds exactly like the uncut card.
 */
function tierGeometry(u0, u1, door = null) {
  const rows = ROWS.filter((r) => r.u >= u0 - 1e-9 && r.u <= u1 + 1e-9);
  const p0 = rows[0]; const p1 = rows[rows.length - 1];
  const dr = p1.rho - p0.rho; const dy = p1.y - p0.y; const L = Math.hypot(dr, dy);
  const d = [dr / L, dy / L]; const n = [d[1], -d[0]]; // card +Y, card +Z (outward) in (rho, y)
  const loc = (rho, y) => [(rho - p0.rho) * d[0] + (y - p0.y) * d[1], (rho - p0.rho) * n[0] + (y - p0.y) * n[1]];
  const m = mesher();
  const h = CARD_T / 2;
  // one strip over rows rs, across x = xa(r) .. xb(r); caps = which cut edges get a cream edge face
  const strip = (rs, xa, xb, caps) => {
    const F = []; const B = [];
    for (const r of rs) {
      const [ly, lz] = loc(r.rho, r.y);
      const ny = r.nr * d[0] + r.ny * d[1]; const nz = r.nr * n[0] + r.ny * n[1];
      const f = []; const b = [];
      for (const x of [xa(r), xb(r)]) {
        f.push(m.v(x, ly + h * ny, lz + h * nz, 0, ny, nz, goreUv(x, r.sigma), 1));
        b.push(m.v(x, ly - h * ny, lz - h * nz, 0, -ny, -nz, goreUv(x, r.sigma), 1));
      }
      F.push(f); B.push(b);
    }
    for (let j = 0; j + 1 < rs.length; j++) {
      m.quad(F[j][0], F[j][1], F[j + 1][1], F[j + 1][0]);
      m.quad(B[j][0], B[j + 1][0], B[j + 1][1], B[j][1]);
    }
    for (const s of [0, 1]) { // side cut edges (seams, or door jambs)
      const sx = s ? 1 : -1; const E = [];
      for (let j = 0; j < rs.length; j++) E.push([m.v(...m.pos(F[j][s]), sx, 0, 0, WHITE_UV, EDGE), m.v(...m.pos(B[j][s]), sx, 0, 0, WHITE_UV, EDGE)]);
      for (let j = 0; j + 1 < rs.length; j++) m.quad(E[j][0], E[j + 1][0], E[j + 1][1], E[j][1]);
    }
    for (const [j, sy, on] of [[0, -1, caps.bottom], [rs.length - 1, 1, caps.top]]) {
      if (!on) continue;
      const q = [F[j][0], F[j][1], B[j][1], B[j][0]].map((i) => m.v(...m.pos(i), 0, sy, 0, WHITE_UV, EDGE));
      m.quad(q[0], q[1], q[2], q[3]);
    }
  };
  const seamL = (r) => -r.hw; const seamR = (r) => r.hw;
  if (!door) strip(rows, seamL, seamR, { bottom: true, top: true });
  else {
    const legs = rows.filter((r) => r.u <= DOOR_U + 1e-9); const head = rows.filter((r) => r.u >= DOOR_U - 1e-9);
    strip(legs, seamL, () => door.x0, { bottom: true, top: false });
    strip(legs, () => door.x1, seamR, { bottom: true, top: false });
    strip(head, seamL, seamR, { bottom: true, top: true }); // its bottom cap is the door head (lintel underside)
  }
  return { geometry: m.done(), L, alpha: Math.atan2(dy, dr), rho0: p0.rho, y0: p0.y };
}

/** Planar slab from 2-D outline(s) (card XY; an array of outlines = disjoint pieces of one card), uv fn for the faces. */
function slabGeometry(outlines, thick, uvFn) {
  const m = mesher();
  for (const outline of Array.isArray(outlines[0][0]) ? outlines : [outlines]) slabInto(m, outline, thick, uvFn);
  return m.done();
}

/** Keep the part of a polygon with sgn * (x - x0) >= 0 (Sutherland-Hodgman, one vertical clip line). */
function clipX(poly, x0, sgn) {
  const inside = (p) => sgn * (p[0] - x0) >= 0;
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]; const b = poly[(i + 1) % poly.length];
    if (inside(a)) out.push(a);
    if (inside(a) !== inside(b)) { const t = (x0 - a[0]) / (b[0] - a[0]); out.push([x0, a[1] + t * (b[1] - a[1])]); }
  }
  return out;
}

function slabInto(m, outline, thick, uvFn) {
  const h = thick / 2;
  const tris = THREE.ShapeUtils.triangulateShape(outline.map(([x, y]) => new THREE.Vector2(x, y)), []);
  const f = outline.map(([x, y]) => m.v(x, y, h, 0, 0, 1, uvFn(x, y), 1));
  const b = outline.map(([x, y]) => m.v(x, y, -h, 0, 0, -1, uvFn(x, y), 1));
  const ccw = THREE.ShapeUtils.isClockWise(outline.map(([x, y]) => new THREE.Vector2(x, y))) ? -1 : 1;
  for (const [a, b2, c] of tris) {
    if (ccw > 0) { m.tri(f[a], f[b2], f[c]); m.tri(b[a], b[c], b[b2]); } else { m.tri(f[a], f[c], f[b2]); m.tri(b[a], b[b2], b[c]); }
  }
  for (let i = 0; i < outline.length; i++) {
    const [x0, y0] = outline[i]; const [x1, y1] = outline[(i + 1) % outline.length];
    const l = Math.hypot(x1 - x0, y1 - y0) || 1; const nx = ccw * (y1 - y0) / l; const ny = -ccw * (x1 - x0) / l;
    const q = [[x0, y0, h], [x1, y1, h], [x1, y1, -h], [x0, y0, -h]].map(([x, y, z]) => m.v(x, y, z, nx, ny, 0, WHITE_UV, EDGE));
    m.quad(q[0], q[1], q[2], q[3]);
  }
}

/** Stack height of a folded gore (+ the cap) under the base ring: the ring's hinge goes above it. */
const STACK_TOP = FLAP_LAYER_GAP + STEP + 2 * (TIERS_U.length - 1) * STEP + CAP_T + 0.01;

/** Shared geometries (identical for every gore of every dome) + the per-tier chord data. */
export function buildGeometries() {
  const tiers = [];
  for (let i = 0; i + 1 < TIERS_U.length; i++) tiers.push(tierGeometry(TIERS_U[i], TIERS_U[i + 1]));
  // base ring card: hinge raised above the folded stack, skirt to the page, saw-tooth top cut (2 teeth per gore)
  const { w: W, r: ringR } = LAYOUT.ring;
  const hy = STACK_TOP;
  const yv = RING.valley * H - hy; const yp = RING.peak * H - hy;
  const outline = [[-W / 2, -hy], [W / 2, -hy]];
  const T = RING.teeth;
  for (let k = T; k >= 0; k--) {
    const x = -W / 2 + (W * k) / T;
    outline.push([x, yv]);
    if (k > 0) outline.push([x - W / (2 * T), yp]);
  }
  const ringUv = (x, y) => uvOf(LAYOUT.ring.x + (x + W / 2) * LAYOUT.PX, LAYOUT.ring.y + (RING.peak * H - (y + hy)) * LAYOUT.PX);
  const ring = slabGeometry(outline, CARD_T, ringUv);
  // [wave4-J] doorway variants: tier 1 notched + base ring broken, one pair per distinct door offset within its gore
  const doorGeo = new Map(); // key 'd<k>' -> { tier, ring }
  for (const c of domeCentres()) {
    for (const dr of doorsOf(c)) {
      if (doorGeo.has(dr.key)) continue;
      const hd = DOOR_W / 2;
      // dr.delta is already clamped clear of the seams (doorsOf), so the notch and the ring gap share one bearing
      const xt = tiers[0].rho0 * Math.tan(dr.delta); const xr = ringR * Math.tan(dr.delta);
      doorGeo.set(dr.key, {
        tier: tierGeometry(TIERS_U[0], TIERS_U[1], { x0: xt - hd, x1: xt + hd }).geometry,
        ring: slabGeometry([clipX(outline, xr - hd, -1), clipX(outline, xr + hd, 1)], CARD_T, ringUv),
      });
    }
  }
  // apex cap: a drum hinged on the top edge of one gore; card +Y points inward across the opening, +Z up
  const top = rowAt(U_TOP);
  const rc = LAYOUT.cap.r;
  const circle = [];
  for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; circle.push([Math.cos(a) * rc, top.rho + Math.sin(a) * rc]); }
  const capUv = (x, y) => uvOf(LAYOUT.cap.x + x * LAYOUT.PX, LAYOUT.cap.y - (y - top.rho) * LAYOUT.PX);
  const cap = slabGeometry(circle, CAP_T, capUv);
  // every drawn geometry by anchor key (userData.geo): 'tier<i>' | 'ring' | 'cap' | 'tier0:d<k>' | 'ring:d<k>'
  const byKey = new Map([...tiers.map((t, i) => ['tier' + i, t.geometry]), ['ring', ring], ['cap', cap]]);
  for (const [k, g] of doorGeo) { byKey.set('tier0:' + k, g.tier); byKey.set('ring:' + k, g.ring); }
  return { tiers, ring, cap, ringR, ringHinge: hy, capHub: top.rho, byKey };
}

/**
 * [wave4-J] Doorways of one dome, derived exactly as world/collide.js derives its jamb gaps (one source: SITE): the
 * bearing to the lobby hub, plus every link-gallery end point lying within 1 u of this dome's glass foot.
 * Bearing = atan2(dz, dx) (+z = south). Each door falls inside one gore (doors are 1 u, gores ~2.1 u at the foot):
 * gore = the one whose centre bearing is nearest, delta = gore centre bearing - door bearing (card +X = toward
 * smaller bearings, so the door centre sits at card x = rho * tan(delta)). delta is clamped to DOOR_MAX_DELTA;
 * bearing = where the path arrives, doorBearing = where the opening is drawn and the collider leaves its gap.
 * @param {{ id: string, x: number, z: number }} c a dome centre (domeCentres())
 */
export function doorsOf(c) {
  const [hubX, hubZ] = ftToWorld(SITE.lobby.x, SITE.lobby.y);
  const bearings = [Math.atan2(hubZ - c.z, hubX - c.x)];
  const centres = domeCentres();
  for (const p of SITE.paths) {
    if (p.region !== 'link') continue;
    for (const [xf, yf] of p.pts) {
      const [x, z] = ftToWorld(xf, yf);
      let best = null; let bd = Infinity; // nearest dome foot, as collide.js
      for (const d of centres) { const e = Math.abs(Math.hypot(x - d.x, z - d.z) - BASE_R); if (e < bd) { bd = e; best = d; } }
      if (best && best.id === c.id && bd < 1) bearings.push(Math.atan2(z - c.z, x - c.x));
    }
  }
  const step = (2 * Math.PI) / N_GORES;
  return bearings.map((b) => {
    const gore = ((Math.round((Math.PI / 2 - b) / step) % N_GORES) + N_GORES) % N_GORES;
    let delta = Math.PI / 2 - goreAngle(gore) - b; delta -= Math.round(delta / (2 * Math.PI)) * 2 * Math.PI;
    delta = Math.max(-DOOR_MAX_DELTA, Math.min(DOOR_MAX_DELTA, delta));
    return { bearing: b, doorBearing: Math.PI / 2 - goreAngle(gore) - delta, gore, delta, key: 'd' + Math.round(delta * 1e4) };
  });
}

/** Largest door offset (rad from its gore centre) that keeps the opening DOOR_SEAM_MARGIN inside its own gore card, on
 * both cards it cuts: the tier-1 card at its foot (narrowest) and the base ring. A door nearer a seam would cut the seam
 * and the neighbour's edge, so it is drawn (and collided, collide.js) at this offset instead (issue #10). */
const DOOR_MAX_DELTA = Math.min(...[rowAt(TIERS_U[0]).rho, LAYOUT.ring.r].map((rho) =>
  Math.atan((rho * Math.tan(Math.PI / N_GORES) - DOOR_W / 2 - DOOR_SEAM_MARGIN) / rho)));

// ---- flaps ------------------------------------------------------------------------------------------------------------------
const rotX = (a) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), a);
const DEG = Math.PI / 180;

/** Angular distance (0..1 of pi) of gore g's centre from the camera side (+Z). */
export const goreAngle = (g) => (2 * Math.PI * g) / N_GORES;
const angFrac = (g) => { const a = Math.abs(((goreAngle(g) + Math.PI) % (2 * Math.PI)) - Math.PI); return a / Math.PI; };
export const inSector = (g) => angFrac(g) * 180 <= SECTOR_HALF_DEG + 1e-6;
/** The cap hangs off the gore facing away from the camera (never in the cutaway sector). */
export const CAP_GORE = N_GORES / 2;

/** A hinge node plus its non-hinge `anchor` child, which carries the drawn geometry (userData.geo) and the mesh offset. */
function flap(name, geo, fields, off = [0, 0, 0]) {
  const node = new THREE.Object3D();
  node.name = name;
  node.userData = { hinge: true, sway: 0, stiffness: FEEL.stiffness, wobble: FEEL.wobble, ...fields };
  const anchor = new THREE.Object3D();
  anchor.name = name + '_mesh';
  anchor.position.set(off[0], off[1], off[2]);
  anchor.userData = { geo, part: fields.part, gore: fields.gore, tier: fields.tier };
  node.add(anchor);
  return { node, anchor };
}

/**
 * One dome as two fold groups (main + cutaway sector), both at the dome's local origin (place them at its centre).
 * Drawn pieces are the `anchor` children (userData.geo = 'tier<i>' | 'ring' | 'cap').
 *
 * Accordion stacking without shape error: a child hinge sits STEP off the parent card, on the face that ends up on
 * top when folded, and the child's mesh is shifted back by the same vector (expressed in the child's frame). At rest
 * every card therefore lies exactly on the profile; folded, the two shifts add up and the child lies 2 x STEP above
 * its parent. (RotX(b) * (0,0,1) = (0, -sin b, cos b), so the parent normal in the child frame is (0, sin b, cos b).)
 */
export function buildDome(geos, id = 'dome') {
  const main = new THREE.Group(); main.name = id + '_main';
  const sector = new THREE.Group(); sector.name = id + '_cut';
  const T = geos.tiers.length;
  let cap = null;
  const centre = domeCentres().find((e) => e.id === id);
  const doors = centre ? doorsOf(centre) : [];
  if (new Set(doors.map((dr) => dr.gore)).size !== doors.length) throw new Error(`[domes] two doorways share a gore on ${id}`);
  for (let g = 0; g < N_GORES; g++) {
    const host = inSector(g) ? sector : main;
    const a = angFrac(g);
    const door = doors.find((dr) => dr.gore === g); // [wave4-J] at most one door per gore (asserted below)
    const gore = new THREE.Group(); gore.name = `${id}_gore${g}`;
    gore.rotation.y = goreAngle(g); // gore +Z = (sin, 0, cos): gore 0 faces +Z (the camera side)
    host.add(gore);
    // accordion: folded absolute chord angle A_f alternates 180 deg (pointing inward, outer face up) / 0 deg
    let parent = null; let prevAlpha = 0; let prevAf = 0;
    const base = FLAP_LAYER_GAP + (g % 2 ? STEP : 0); // odd gores one step up: overlapping neighbours never coplanar
    const childOf = (alpha, Af, i) => {
      const sgn = i % 2 === 0 ? 1 : -1; // parent tier index i (0-based): which face ends up on top
      const b = prevAlpha - alpha;
      return { pos: [0, geos.tiers[i].L + parent.anchor.position.y, sgn * STEP + parent.anchor.position.z],
        off: [0, -sgn * STEP * Math.sin(b), -sgn * STEP * Math.cos(b)], q: rotX(b) };
    };
    for (let i = 0; i < T; i++) {
      const t = geos.tiers[i];
      const Af = i % 2 === 0 ? Math.PI : 0;
      const fields = {
        foldAngle: i === 0 ? t.alpha - Af : (t.alpha - Af) - (prevAlpha - prevAf),
        delay: 0.08 + (0.72 * i) / (T - 1) + 0.12 * a,
        layer: i, size: Math.min(1, t.L / TILE_SIZE), part: 'tier', gore: g, tier: i + 1,
      };
      let f;
      if (i === 0) {
        // the hinge stands `base` above the page; the card is shifted back down so the glass starts at y = 0
        f = flap(`${id}_g${g}_t1`, door ? 'tier0:' + door.key : 'tier0', fields, [0, -base * Math.sin(t.alpha), base * Math.cos(t.alpha)]);
        f.node.position.set(0, base, t.rho0);
        f.node.quaternion.copy(rotX(Math.PI / 2 - t.alpha));
        gore.add(f.node);
      } else {
        const c = childOf(t.alpha, Af, i - 1);
        f = flap(`${id}_g${g}_t${i + 1}`, 'tier' + i, fields, c.off);
        f.node.position.set(...c.pos);
        f.node.quaternion.copy(c.q);
        parent.node.add(f.node);
      }
      parent = f; prevAlpha = t.alpha; prevAf = Af;
    }
    if (g === CAP_GORE) {
      const alphaCap = Math.PI; const AfCap = prevAf === 0 ? Math.PI : 0;
      const c = childOf(alphaCap, AfCap, T - 1);
      cap = flap(`${id}_cap`, 'cap', {
        foldAngle: (alphaCap - AfCap) - (prevAlpha - prevAf), delay: 1, layer: T, size: 0.3, part: 'cap', gore: g, tier: T + 1, wobble: 0.5,
      }, c.off);
      cap.node.position.set(...c.pos);
      cap.node.quaternion.copy(c.q);
      parent.node.add(cap.node);
    }
    // base ring card of this gore: upright, folds inward over the stack (foldAngle < 0: printed face lands up)
    const lean = 1.2 * DEG;
    const ring = flap(`${id}_g${g}_ring`, door ? 'ring:' + door.key : 'ring', {
      foldAngle: -Math.PI / 2 - lean, delay: 0.06 * a, layer: T + 2, size: Math.min(1, (RING.peak * H) / TILE_SIZE),
      part: 'ring', gore: g, tier: 0, wobble: 0.4,
    });
    ring.node.position.set(0, geos.ringHinge, geos.ringR);
    ring.node.quaternion.copy(rotX(lean));
    gore.add(ring.node);
  }
  return { main, sector, cap };
}

/** Every drawn anchor of a group (userData.geo), in traversal order. */
export function anchorsOf(group) {
  const out = [];
  group.traverse((o) => { if (o.userData && o.userData.geo) out.push(o); });
  return out;
}

/** World-unit dome centres from the site map (SITE feet -> z = -y -> units). */
export function domeCentres() {
  return SITE.domes.map((d) => ({ id: d.id, x: d.x / UNIT_FT, z: -d.y / UNIT_FT }));
}

export const BASE_R = rAt(0) * R; // base-ring radius of the glass (u = 0)

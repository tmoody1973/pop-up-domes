// Site collision (wave3-G): the walls of the Mitchell Park set-pieces as a signed distance field, combined into
// world.clearanceAt (room to the nearest blocker; <= 0 = the feet cannot stand there). Every shape is derived at build
// time from its one source: SITE (sitemap.js) for dome centres and pools; domes/shell.js for the ring radius and the
// doorway bearings (doorsOf, the same ones the dome cards are cut at); the built arcade / lobby groups (site/pieces.js, placed by site/index.js) for arch, wall and door positions.
//   domes:  the base ring (glass foot to saw-tooth ring) as an annulus, cut by a doorway toward the lobby hub and at
//           every link-gallery end (SITE.paths region 'link'). Only while that dome is risen (main fold >= half up).
//   lobby:  four walls of the pop-up box, a door in the middle of the wall facing the arcade and each dome.
//   arcade: the arch row, open only through the door arches (the middle three, photo 07), and the stucco wall behind
//           it, open behind those same three bays.
//   pools:  the water rectangle of each reflecting pool (the 2-ft coping stays walkable).
import { SITE, ftToWorld } from './sitemap.js';
import * as S from './domes/shell.js';

const FAR = 4; // = world.js FREE: open ground
/** Clear width (world units) of a dome doorway at the ring: 1.0 u = 12 ft (a vestibule; plan 06 link necks ~ 12-25 ft). */
const DOME_DOOR_W = 1.0;
/** Clear width of each lobby door: the printed entrance doors of the front wall (site/pieces.js lobbyWall, 0.7 u). */
const LOBBY_DOOR_W = 0.7;
/** Arches with doors under them (photo 07: doors under the middle three); the outer six are glazed and block. */
const ARCADE_DOOR_ARCHES = 3;
const CARD_HALF = 0.04; // half-thickness of a standing set-piece wall for collision (card 0.016 + glazing + slack)
const RISEN = 0.5; // a dome blocks once its main fold is at least half up

const len2 = (x, z) => Math.sqrt(x * x + z * z);

/** Distance from (px,pz) to segment a-b. */
function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax; const dz = bz - az;
  let t = ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return len2(px - ax - dx * t, pz - az - dz * t);
}

/** A straight wall along unit u from origin o, solid over [s0, s1] minus the open spans `gaps` ([[g0, g1], ...]). */
function wallSegments(ox, oz, ux, uz, s0, s1, gaps) {
  const cuts = gaps.slice().sort((a, b) => a[0] - b[0]);
  const out = []; let s = s0;
  for (const [g0, g1] of cuts) { if (g0 > s) out.push([s, g0]); s = Math.max(s, g1); }
  if (s < s1) out.push([s, s1]);
  return out.map(([a, b]) => [ox + ux * a, oz + uz * a, ox + ux * b, oz + uz * b]);
}

function worldXZ(o) { o.updateWorldMatrix(true, false); const e = o.matrixWorld.elements; return [e[12], e[14]]; }

/** Half the clear opening at the foot of an arch card: smallest |x| of a foot vertex beyond the mullions (W / 4). */
function archOpening(mesh) {
  const g = mesh.geometry; g.computeBoundingBox();
  const W = g.boundingBox.max.x - g.boundingBox.min.x;
  const p = g.attributes.position; let inner = W / 2;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(p.getX(i));
    if (Math.abs(p.getY(i)) < 1e-4 && ax > W / 4 && ax < inner) inner = ax;
  }
  return { W, half: inner };
}

/**
 * @param {{ site: THREE.Object3D }} opts the site root group (world/site/index.js) holding the 'arcade' and 'lobby'
 * @returns {{ clearance(x:number, z:number): number, setDomes(handle): void, shapes: object }}
 */
export function createCollider({ site }) {
  const segs = []; // [ax, az, bx, bz] solid wall segments (lobby, arcade)
  const find = (name) => site.getObjectByName(name);

  // ---- domes: ring annulus + doorways (bearings from SITE) ----
  const rIn = S.BASE_R; // glass foot
  const rOut = S.LAYOUT.ring.r / Math.cos(Math.PI / S.N_GORES); // saw-tooth ring at its polygon corners
  const ringR = (rIn + rOut) / 2; const ringHalf = (rOut - rIn) / 2;
  const doorHalfAng = Math.asin((DOME_DOOR_W / 2 + ringHalf) / ringR); // jamb faces DOME_DOOR_W apart
  // doorways where the dome draws them (shell.js doorsOf: hub + link ends, kept clear of the gore seams; issue #10)
  const domes = S.domeCentres().map((c) => ({ ...c, doors: S.doorsOf(c).map((d) => d.doorBearing), fold: null }));
  for (const d of domes) d.jambs = d.doors.flatMap((a) => [a - doorHalfAng, a + doorHalfAng].map((b) => [d.x + ringR * Math.cos(b), d.z + ringR * Math.sin(b)]));

  // ---- lobby: walls from the built flaps; a centred door in the wall facing the arcade and each dome ----
  const lobby = find('lobby'); const arcade = find('arcade');
  const lobbyWalls = [];
  if (lobby) {
    const [cx, cz] = worldXZ(lobby);
    lobby.children.filter((o) => /^lobby_wall_\d$/.test(o.name)).forEach((w) => {
      const [px, pz] = worldXZ(w); const hl = len2(px - cx, pz - cz);
      lobbyWalls.push({ px, pz, nx: (px - cx) / hl, nz: (pz - cz) / hl, hl, door: false });
    });
    const targets = [...domes.map((d) => [d.x, d.z]), arcade ? worldXZ(arcade) : null].filter(Boolean);
    for (const [tx, tz] of targets) {
      const l = len2(tx - cx, tz - cz); let best = null; let bd = -2;
      for (const w of lobbyWalls) { const dp = (w.nx * (tx - cx) + w.nz * (tz - cz)) / l; if (dp > bd) { bd = dp; best = w; } }
      if (best) best.door = true;
    }
    const dh = LOBBY_DOOR_W / 2 + CARD_HALF;
    // tangent (-nz, nx); walls overlap at the corners by CARD_HALF so the box is sealed
    for (const w of lobbyWalls) segs.push(...wallSegments(w.px, w.pz, -w.nz, w.nx, -w.hl - CARD_HALF, w.hl + CARD_HALF, w.door ? [[-dh, dh]] : []));
  } else console.warn('[collide] no lobby set-piece: lobby walls do not block');

  // ---- arcade: arch row with door arches open, stucco wall behind open behind them ----
  const arcadeInfo = { arches: 0, doors: [] };
  if (arcade) {
    const arches = arcade.children.filter((o) => /^arch_\d+$/.test(o.name)).sort((a, b) => +a.name.slice(5) - +b.name.slice(5));
    const wall = arcade.getObjectByName('arcade_wall');
    const pts = arches.map(worldXZ);
    const [ox, oz] = pts[0]; const [ex, ez] = pts[pts.length - 1];
    const span = len2(ex - ox, ez - oz); const ux = (ex - ox) / span; const uz = (ez - oz) / span;
    const spacing = span / (pts.length - 1);
    const { W, half } = archOpening(arches[0].getObjectByProperty('isMesh', true));
    const mid = (pts.length - 1) / 2; const k = (ARCADE_DOOR_ARCHES - 1) / 2;
    const doorIdx = []; for (let i = Math.ceil(mid - k); i <= Math.floor(mid + k); i++) doorIdx.push(i);
    const gh = half - CARD_HALF; // the opening is between the frame's inner feet
    segs.push(...wallSegments(ox, oz, ux, uz, -W / 2, span + W / 2, doorIdx.map((i) => [i * spacing - gh, i * spacing + gh])));
    if (wall) {
      const [wx, wz] = worldXZ(wall);
      const wm = wall.getObjectByProperty('isMesh', true); wm.geometry.computeBoundingBox();
      const wHalf = (wm.geometry.boundingBox.max.x - wm.geometry.boundingBox.min.x) / 2;
      // wall origin = its hinge (mid row); row coordinate s measured from arch 0 -> shift by the projection
      const s0 = (wx - ox) * ux + (wz - oz) * uz; const bx = wx - ux * s0; const bz = wz - uz * s0;
      const g0 = doorIdx[0] * spacing - spacing / 2; const g1 = doorIdx[doorIdx.length - 1] * spacing + spacing / 2;
      segs.push(...wallSegments(bx, bz, ux, uz, s0 - wHalf, s0 + wHalf, [[g0, g1]]));
    }
    Object.assign(arcadeInfo, { arches: pts.length, spacing, W, opening: 2 * gh, origin: [ox, oz], u: [ux, uz], doors: doorIdx.map((i) => [ox + ux * i * spacing, oz + uz * i * spacing]) });
  } else console.warn('[collide] no arcade set-piece: arcade does not block');

  // ---- pools: water rectangles along SITE.axis ----
  const unit = ftToWorld(1, 0)[0]; // world units per foot
  const pax = SITE.axis[0]; const paz = -SITE.axis[1]; // axis in world x / z (z = -y)
  const pools = SITE.pools.map((p) => { const [x, z] = ftToWorld(p.x, p.y); return { x, z, hl: (p.len / 2) * unit, hw: (p.width / 2) * unit }; });

  // ---- broad phase: one bounding circle around everything ----
  const ext = [...domes.map((d) => [d.x, d.z, rOut]), ...segs.flatMap((s) => [[s[0], s[1], 0], [s[2], s[3], 0]]), ...pools.map((p) => [p.x, p.z, p.hl + p.hw])];
  const bx = ext.reduce((a, e) => a + e[0], 0) / ext.length; const bz = ext.reduce((a, e) => a + e[1], 0) / ext.length;
  const bR = Math.max(...ext.map((e) => len2(e[0] - bx, e[1] - bz) + e[2])) + FAR;

  function domeClear(d, x, z) {
    const dx = x - d.x; const dz = z - d.z; const r = len2(dx, dz);
    if (r - rOut > FAR) return FAR;
    const a = Math.atan2(dz, dx);
    for (let i = 0; i < d.doors.length; i++) {
      let da = a - d.doors[i]; da -= Math.round(da / (2 * Math.PI)) * 2 * Math.PI;
      if (Math.abs(da) < doorHalfAng) { // in the doorway: room to the nearer jamb
        const j0 = d.jambs[2 * i]; const j1 = d.jambs[2 * i + 1];
        return Math.min(len2(x - j0[0], z - j0[1]), len2(x - j1[0], z - j1[1])) - ringHalf;
      }
    }
    return Math.abs(r - ringR) - ringHalf;
  }

  function clearance(x, z) {
    if (len2(x - bx, z - bz) > bR) return FAR;
    let c = FAR;
    for (const d of domes) if (d.fold && d.fold.progress >= RISEN) { const v = domeClear(d, x, z); if (v < c) c = v; }
    for (let i = 0; i < segs.length; i++) { const s = segs[i]; const v = segDist(x, z, s[0], s[1], s[2], s[3]) - CARD_HALF; if (v < c) c = v; }
    for (const p of pools) {
      const dx = x - p.x; const dz = z - p.z;
      const qa = Math.abs(dx * pax + dz * paz) - p.hl; const qb = Math.abs(-dx * paz + dz * pax) - p.hw;
      const v = qa > 0 || qb > 0 ? len2(Math.max(qa, 0), Math.max(qb, 0)) : Math.max(qa, qb);
      if (v < c) c = v;
    }
    return c;
  }

  return {
    clearance,
    /** Link the dome set-pieces (world/domes.js createDomes result): a dome blocks only while risen. */
    setDomes(handle) {
      for (const d of domes) { const h = handle && handle.domes.find((e) => e.id === d.id); d.fold = h ? h.folds[0] : null; }
    },
    /** Debug / tests: the derived shapes (world units). */
    shapes: { domes, ringR, ringHalf, rIn, rOut, doorHalfAng, domeDoorW: DOME_DOOR_W, lobbyDoorW: LOBBY_DOOR_W, lobbyWalls, arcade: arcadeInfo, segs, pools, axis: [pax, paz] },
  };
}

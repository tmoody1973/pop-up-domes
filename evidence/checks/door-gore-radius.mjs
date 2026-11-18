// Dome radius check for every gore, door gores included (issue #9; replaces the /private/tmp-bound
// evidence/wave6/p-doors-headsitemap.mjs). Same method as wave2 fidelity / wave4-J doors.mjs:
// build each dome from app/src at rest (risen, cutaway sector up), take the outer printed face at both seams of
// every tier card, interpolate seam radius at each BUILD-NOTES §2 row u <= 0.95, compare with PROFILE x R.
// Door cards: jamb vertices (|x| < 0.95 x card half-width) are not seams and are skipped.
// Goal (VISION): |radius error| <= 3 % at every row u <= 0.95. Exits 1 when any gore is over.
// Run: cd app && npm ci && node ../evidence/checks/door-gore-radius.mjs
const APP = new URL('../../app/', import.meta.url);
const THREE = await import(new URL('node_modules/three/build/three.module.js', APP));
const S = await import(new URL('src/world/domes/shell.js', APP));
const { createFoldInstance } = await import(new URL('src/world/fold.js', APP));

const LIMIT_PCT = 3;
const U_MAX = 0.95;
const geos = S.buildGeometries();

function risenAnchors(c) {
  const d = S.buildDome(geos, c.id);
  d.main.position.set(c.x, 0, c.z); d.sector.position.set(c.x, 0, c.z);
  createFoldInstance(d.main, { tileId: c.id, staggerSpan: S.STAGGER_SPAN }).snap(1);
  createFoldInstance(d.sector, { tileId: c.id + '_cut', staggerSpan: S.STAGGER_SPAN }).snap(1);
  d.main.updateMatrixWorld(true); d.sector.updateMatrixWorld(true);
  return [...S.anchorsOf(d.main), ...S.anchorsOf(d.sector)];
}

// seam key ('<gore>L' | '<gore>R') -> [[y, radius], ...] in world space
function seamPoints(c) {
  const seams = new Map(); const v = new THREE.Vector3();
  for (const an of risenAnchors(c)) {
    const ud = an.userData; if (ud.part !== 'tier') continue;
    const g = geos.byKey.get(ud.geo); const P = g.attributes.position; const C = g.attributes.color; const N = g.attributes.normal;
    const isDoorCard = ud.geo.includes(':');
    let xmax = 0; for (let i = 0; i < P.count; i++) xmax = Math.max(xmax, Math.abs(P.getX(i)));
    for (let i = 0; i < P.count; i++) {
      if (C.getX(i) !== 1 || N.getZ(i) <= 0) continue; // outer printed face only
      if (isDoorCard && Math.abs(P.getX(i)) < 0.95 * xmax) continue;
      const key = ud.gore + (P.getX(i) > 0 ? 'R' : 'L');
      v.fromBufferAttribute(P, i).applyMatrix4(an.matrixWorld);
      if (!seams.has(key)) seams.set(key, []);
      seams.get(key).push([v.y, Math.hypot(v.x - c.x, v.z - c.z)]);
    }
  }
  for (const pts of seams.values()) pts.sort((a, b) => a[0] - b[0]);
  return seams;
}

function radiusAt(pts, y) {
  if (y <= pts[0][0]) return pts[0][1];
  for (let k = 1; k < pts.length; k++) {
    if (pts[k][0] >= y) { const [y0, r0] = pts[k - 1]; const [y1, r1] = pts[k]; return r0 + (r1 - r0) * (y - y0) / Math.max(1e-9, y1 - y0); }
  }
  return null; // row above this seam's top: no measurement
}

const rows = []; const worst = { away: { pct: 0 }, door: { pct: 0 } }; const doorWorstByDome = {};
let missing = 0;
for (const c of S.domeCentres()) {
  const doorGores = new Set(S.doorsOf(c).map((d) => d.gore));
  const seams = seamPoints(c);
  doorWorstByDome[c.id] = { pct: 0 };
  for (const [u, rt] of S.PROFILE) {
    if (u > U_MAX) continue;
    const want = rt * S.R; const y = u * S.H;
    for (const [key, pts] of seams) {
      const gore = parseInt(key, 10); const r = radiusAt(pts, y);
      // NaN would never compare as "over the limit", so a broken seam must fail here, not pass silently
      if (r === null || !Number.isFinite(r)) { missing++; console.log(`no finite seam radius at u=${u} for ${c.id} seam ${key}`); continue; }
      const pct = (r - want) / want * 100;
      const kind = doorGores.has(gore) ? 'door' : 'away';
      const hit = { dome: c.id, gore: key, u, pct };
      if (Math.abs(pct) > Math.abs(worst[kind].pct)) worst[kind] = hit;
      if (kind === 'door' && Math.abs(pct) > Math.abs(doorWorstByDome[c.id].pct)) doorWorstByDome[c.id] = hit;
      rows.push({ ...hit, kind });
    }
  }
}

const fmt = (w) => `${Math.abs(w.pct).toFixed(2)} % (${w.dome} seam ${w.gore}, u = ${w.u})`;
console.log(`Seams measured: ${new Set(rows.map((r) => r.dome + r.gore)).size} across ${Object.keys(doorWorstByDome).length} domes; rows u <= ${U_MAX}; limit +-${LIMIT_PCT} %`);
for (const [id, w] of Object.entries(doorWorstByDome)) console.log(`  ${id.padEnd(9)} worst door-gore |err| ${fmt(w)}`);
console.log(`WORST gores away from doorways: ${fmt(worst.away)}`);
console.log(`WORST door gores (outer seams): ${fmt(worst.door)}`);
const over = rows.filter((r) => Math.abs(r.pct) > LIMIT_PCT);
for (const r of over) console.log(`  OVER: ${r.dome} ${r.kind} seam ${r.gore} u=${r.u} ${r.pct.toFixed(2)} %`);
const pass = over.length === 0 && missing === 0 && rows.length > 0;
console.log(pass ? 'PASS' : `FAIL (${over.length} over limit, ${missing} missing)`);
process.exit(pass ? 0 : 1);

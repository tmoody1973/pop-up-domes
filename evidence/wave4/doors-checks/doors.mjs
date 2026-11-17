// [wave4-J] Doorway checks (Node, rest pose, every dome risen, cutaway sector up):
//  1. walk lines: for each doorway, a radial segment r = 4.3 .. 6.9 u along the door bearing, raycast against every
//     dome card (world space). Lines at chest (0.36 u = focusHeight 0.6 x TRAVELLER_HEIGHT), feet (0.05) and head
//     (0.60), each on the centre line and +-0.12 u (traveller radius) to the side. Baseline = same dome with the
//     doorway variants swapped back to the plain tier 1 / ring cards (what shipped before wave 4).
//  2. fidelity re-run (wave2 fidelity.mjs method): seam radius vs BUILD-NOTES §2 rows u <= 0.95, +-3 %.
const APP = '/Users/tarikmoody/Projects/domes/app/';
const THREE = await import(APP + 'node_modules/three/build/three.module.js');
const S = await import(APP + 'src/world/domes/shell.js');
const { createFoldInstance } = await import(APP + 'src/world/fold.js');
const geos = S.buildGeometries();
const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
const DEG = 180 / Math.PI;

function risen(c) {
  const d = S.buildDome(geos, c.id);
  d.main.position.set(c.x, 0, c.z); d.sector.position.set(c.x, 0, c.z);
  createFoldInstance(d.main, { tileId: c.id, staggerSpan: S.STAGGER_SPAN }).snap(1);
  createFoldInstance(d.sector, { tileId: c.id + '_cut', staggerSpan: S.STAGGER_SPAN }).snap(1);
  d.main.updateMatrixWorld(true); d.sector.updateMatrixWorld(true);
  return [...S.anchorsOf(d.main), ...S.anchorsOf(d.sector)];
}
const meshesOf = (anchors, baseline) => anchors.map((an) => {
  const key = baseline ? an.userData.geo.split(':')[0] : an.userData.geo;
  const m = new THREE.Mesh(geos.byKey.get(key), mat);
  m.matrixAutoUpdate = false; m.matrixWorld.copy(an.matrixWorld); m.userData = { ...an.userData, name: an.name };
  return m;
});

const R0 = 4.3; const R1 = 6.9; const RAD = 0.12;
const rc = new THREE.Raycaster();
function crossings(meshes, c, b, y, side) {
  const ux = Math.cos(b); const uz = Math.sin(b); const px = -uz * side; const pz = ux * side;
  rc.set(new THREE.Vector3(c.x + ux * R0 + px, y, c.z + uz * R0 + pz), new THREE.Vector3(ux, 0, uz));
  rc.near = 0; rc.far = R1 - R0;
  const hits = rc.intersectObjects(meshes, false);
  return [...new Set(hits.map((h) => h.object.userData.name))];
}

const table = []; let fail = 0; let baseHit = 0;
for (const c of S.domeCentres()) {
  const anchors = risen(c);
  const now = meshesOf(anchors, false); const before = meshesOf(anchors, true);
  for (const dr of S.doorsOf(c)) {
    const row = { dome: c.id, bearing_deg: +(dr.bearing * DEG).toFixed(2), gore: dr.gore };
    const lines = [['chest', 0.36], ['feet', 0.05], ['head', 0.6]];
    for (const [name, y] of lines) {
      let n = 0; const who = new Set();
      for (const side of [0, -RAD, RAD]) for (const h of crossings(now, c, dr.bearing, y, side)) { n++; who.add(h); }
      row[name + '_now'] = n; if (n) { fail++; row[name + '_hit'] = [...who].join(','); }
    }
    row.chest_before = crossings(before, c, dr.bearing, 0.36, 0).join(',') || '-';
    if (row.chest_before !== '-') baseHit++;
    table.push(row);
  }
}
console.log('Walk lines r = ' + R0 + '..' + R1 + ' u along each door bearing; counts = dome cards crossed (centre + both sides at +-' + RAD + ' u)');
console.table(table);
console.log('doorway walk lines crossing a card now:', fail, fail ? 'FAIL' : 'PASS', '| before wave4 (chest, centre line):', baseHit, 'of', table.length, 'crossed');

// ---- fidelity re-run ----
const v = new THREE.Vector3();
let worstAway = 0; let worstDoor = 0; const fid = [];
for (const c of S.domeCentres()) {
  const doorGores = new Set(S.doorsOf(c).map((d) => d.gore));
  const seams = new Map(); const doorSeams = new Map();
  for (const an of risen(c)) {
    const ud = an.userData; if (ud.part !== 'tier') continue;
    const g = geos.byKey.get(ud.geo); const P = g.attributes.position; const C = g.attributes.color; const N = g.attributes.normal;
    const isDoorCard = ud.geo.includes(':');
    let xmax = 0; for (let i = 0; i < P.count; i++) xmax = Math.max(xmax, Math.abs(P.getX(i)));
    for (let i = 0; i < P.count; i++) {
      if (C.getX(i) !== 1 || N.getZ(i) <= 0) continue;
      if (isDoorCard && Math.abs(P.getX(i)) < 0.95 * xmax) continue; // door jamb vertices are not seams
      const key = ud.gore + (P.getX(i) > 0 ? 'R' : 'L');
      v.fromBufferAttribute(P, i).applyMatrix4(an.matrixWorld);
      const M = doorGores.has(ud.gore) ? doorSeams : seams;
      if (!M.has(key)) M.set(key, []);
      M.get(key).push([v.y, Math.hypot(v.x - c.x, v.z - c.z)]);
    }
  }
  const errs = (map, y, want) => {
    let lo = Infinity; let hi = -Infinity;
    for (const pts of map.values()) {
      pts.sort((a, b) => a[0] - b[0]); let r = null;
      if (y <= pts[0][0]) r = pts[0][1];
      else for (let k = 1; k < pts.length; k++) if (pts[k][0] >= y) { const [y0, r0] = pts[k - 1]; const [y1, r1] = pts[k]; r = r0 + (r1 - r0) * (y - y0) / Math.max(1e-9, y1 - y0); break; }
      const e = (r - want) / want * 100; lo = Math.min(lo, e); hi = Math.max(hi, e);
    }
    return [lo, hi];
  };
  for (const [u, rt] of S.PROFILE) {
    if (u > 0.95) continue;
    const want = rt * S.R; const y = u * S.H;
    const [a0, a1] = errs(seams, y, want); const [d0, d1] = errs(doorSeams, y, want);
    worstAway = Math.max(worstAway, Math.abs(a0), Math.abs(a1)); worstDoor = Math.max(worstDoor, Math.abs(d0), Math.abs(d1));
    fid.push({ dome: c.id, u, want_units: +want.toFixed(3), away_min_pct: +a0.toFixed(2), away_max_pct: +a1.toFixed(2), doorgore_min_pct: +d0.toFixed(2), doorgore_max_pct: +d1.toFixed(2) });
  }
}
console.table(fid);
console.log('WORST |err| rows u<=0.95, gores away from doorways:', worstAway.toFixed(2) + '%', worstAway <= 3 ? 'PASS' : 'FAIL',
  '| door gores (outer seams):', worstDoor.toFixed(2) + '%', worstDoor <= 3 ? 'PASS' : 'FAIL');

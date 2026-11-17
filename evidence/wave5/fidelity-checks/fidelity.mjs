// [wave5-L] Fidelity judge, measured parts (a) seam radius vs BUILD-NOTES §2, (b) centres vs BUILD-NOTES §4 + identical
// domes, (d) apex cap last in the rise order. Node, rest pose, both fold instances snapped up (wave2 fidelity.mjs and
// wave4 doors.mjs method; geometry by userData.geo key). Usage: node fidelity.mjs
const APP = '/Users/tarikmoody/Projects/domes/app/';
const THREE = await import(APP + 'node_modules/three/build/three.module.js');
const S = await import(APP + 'src/world/domes/shell.js');
const { createFoldInstance } = await import(APP + 'src/world/fold.js');
const geos = S.buildGeometries();
const v = new THREE.Vector3();
const BUILD_NOTES_4 = { show: [0, 0], desert: [169, 0], tropical: [169, -158] }; // ft, +y = north

function risen(c) {
  const d = S.buildDome(geos, c.id);
  d.main.position.set(c.x, 0, c.z); d.sector.position.set(c.x, 0, c.z);
  const fm = createFoldInstance(d.main, { tileId: c.id, staggerSpan: S.STAGGER_SPAN });
  const fs = createFoldInstance(d.sector, { tileId: c.id + '_cut', staggerSpan: S.STAGGER_SPAN });
  fm.snap(1); fs.snap(1);
  d.main.updateMatrixWorld(true); d.sector.updateMatrixWorld(true);
  return { d, fm, fs, anchors: [...S.anchorsOf(d.main), ...S.anchorsOf(d.sector)] };
}
function seamsOf(c, anchors) {
  const seams = new Map();
  for (const an of anchors) {
    const ud = an.userData; if (ud.part !== 'tier') continue;
    const g = geos.byKey.get(ud.geo); const P = g.attributes.position; const C = g.attributes.color; const N = g.attributes.normal;
    const isDoor = ud.geo.includes(':'); let xmax = 0;
    for (let i = 0; i < P.count; i++) xmax = Math.max(xmax, Math.abs(P.getX(i)));
    for (let i = 0; i < P.count; i++) {
      if (C.getX(i) !== 1 || N.getZ(i) <= 0) continue; // outer printed face
      if (isDoor && Math.abs(P.getX(i)) < 0.95 * xmax) continue; // door jambs are not seams
      const key = ud.gore + (P.getX(i) > 0 ? 'R' : 'L');
      v.fromBufferAttribute(P, i).applyMatrix4(an.matrixWorld);
      if (!seams.has(key)) seams.set(key, []);
      seams.get(key).push([v.y, Math.hypot(v.x - c.x, v.z - c.z)]);
    }
  }
  return seams;
}
function radiusAt(pts, y) {
  pts.sort((a, b) => a[0] - b[0]);
  if (y <= pts[0][0]) return pts[0][1];
  for (let k = 1; k < pts.length; k++) if (pts[k][0] >= y) { const [y0, r0] = pts[k - 1]; const [y1, r1] = pts[k]; return r0 + (r1 - r0) * (y - y0) / Math.max(1e-9, y1 - y0); }
  return pts.at(-1)[1];
}

const out = { a: [], b: [], d: [], ident: {} };
let worstA = 0; let worstB = 0; const radiusTables = {}; const shapes = {};
for (const c of S.domeCentres()) {
  const { d, fm, fs, anchors } = risen(c);
  const seams = seamsOf(c, anchors); const tbl = [];
  for (const [u, rt] of S.PROFILE) {
    if (u > 0.95) continue;
    const want = rt * S.R; const y = u * S.H; let lo = Infinity; let hi = -Infinity;
    for (const pts of seams.values()) { const e = (radiusAt(pts, y) - want) / want * 100; lo = Math.min(lo, e); hi = Math.max(hi, e); }
    worstA = Math.max(worstA, Math.abs(lo), Math.abs(hi)); tbl.push([u, +lo.toFixed(2), +hi.toFixed(2)]);
  }
  radiusTables[c.id] = tbl; out.a.push({ dome: c.id, seams: seams.size, rows: tbl.length, err_min_pct: Math.min(...tbl.map((r) => r[1])), err_max_pct: Math.max(...tbl.map((r) => r[2])) });
  // (b) centre as built (group position, units) -> feet, y = -z
  const ft = [d.main.position.x * S.UNIT_FT, -d.main.position.z * S.UNIT_FT]; const ref = BUILD_NOTES_4[c.id];
  const err = Math.hypot(ft[0] - ref[0], ft[1] - ref[1]); worstB = Math.max(worstB, err);
  out.b.push({ dome: c.id, built_ft: ft.map((x) => +x.toFixed(2)), build_notes_ft: ref, err_ft: +err.toFixed(2) });
  // (d) rise order: the cap's start time vs every other flap (main + sector)
  const flaps = [...fm.flaps, ...fs.flaps]; const cap = flaps.find((f) => f.node.userData.part === 'cap');
  const others = flaps.filter((f) => f !== cap); const lastOther = Math.max(...others.map((f) => f.tUp));
  out.d.push({ dome: c.id, flaps: flaps.length, cap_tUp_s: +cap.tUp.toFixed(3), last_other_tUp_s: +lastOther.toFixed(3), cap_last: cap.tUp > lastOther, cap_first_down: cap.tDown === Math.min(...flaps.map((f) => f.tDown)) });
  // identical: every anchor's local transform relative to the dome centre + its geometry key (door keys collapsed)
  shapes[c.id] = anchors.map((an) => { const m = an.matrixWorld.clone(); m.elements[12] -= c.x; m.elements[14] -= c.z;
    return { name: an.name.replace(c.id + '_', ''), geo: an.userData.geo, base: an.userData.geo.split(':')[0], m: m.elements }; });
}
// identical domes: max transform difference, same flap set, which anchors differ only by a doorway variant
const ref = shapes.show; out.ident.anchors = Object.fromEntries(Object.entries(shapes).map(([k, a]) => [k, a.length]));
for (const [id, a] of Object.entries(shapes)) {
  if (id === 'show') continue;
  let dm = 0; let sameBase = true; let doorDiff = 0;
  a.forEach((x, i) => { const y = ref[i]; if (x.name !== y.name || x.base !== y.base) sameBase = false; if (x.geo !== y.geo) doorDiff++;
    for (let k = 0; k < 16; k++) dm = Math.max(dm, Math.abs(x.m[k] - y.m[k])); });
  out.ident[id + '_vs_show'] = { same_card_set: sameBase && a.length === ref.length, max_transform_diff_units: +dm.toExponential(2), cards_with_doorway_variant_differing: doorDiff,
    radius_table_identical: JSON.stringify(radiusTables[id]) === JSON.stringify(radiusTables.show) };
}
console.log('(a) seam radius vs BUILD-NOTES §2 profile, rows u <= 0.95'); console.table(out.a);
console.log('(a) per row (show dome) [u, min %, max %]:', JSON.stringify(radiusTables.show));
console.log('(a) WORST |err|', worstA.toFixed(2) + '%', worstA <= 3 ? 'PASS' : 'FAIL');
console.log('(b) dome centres vs BUILD-NOTES §4 (z = -y, 1 unit =', S.UNIT_FT, 'ft)'); console.table(out.b);
console.log('(b) identical:', JSON.stringify(out.ident, null, 1));
console.log('(b) WORST centre err', worstB.toFixed(2), 'ft', worstB <= 5 ? 'PASS' : 'FAIL');
console.log('(d) rise order'); console.table(out.d);
console.log('(d)', out.d.every((r) => r.cap_last) ? 'PASS' : 'FAIL');

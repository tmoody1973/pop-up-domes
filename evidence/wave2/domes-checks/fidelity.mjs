// Fidelity: rest-pose seam-vertex radius vs BUILD-NOTES §2 table, dome centres vs SITE, fold order.
const APP='/Users/tarikmoody/Projects/domes/app/';
const THREE = await import(APP+'node_modules/three/build/three.module.js');
const S = await import(APP+'src/world/domes/shell.js');
const { SITE } = await import(APP+'src/world/sitemap.js');
const { createFoldInstance } = await import(APP+'src/world/fold.js');
const geos = S.buildGeometries();
const geoOf = (ud) => ud.geo === 'ring' ? geos.ring : ud.geo === 'cap' ? geos.cap : geos.tiers[+ud.geo.slice(4)].geometry;
const v = new THREE.Vector3();
const rows = [];
let worst = 0;
for (const c of S.domeCentres()) {
  const d = S.buildDome(geos, c.id);
  d.main.position.set(c.x, 0, c.z); d.sector.position.set(c.x, 0, c.z);
  const fm = createFoldInstance(d.main, { tileId: c.id, staggerSpan: S.STAGGER_SPAN });
  const fs = createFoldInstance(d.sector, { tileId: c.id + '_cut', staggerSpan: S.STAGGER_SPAN });
  fm.snap(1); fs.snap(1);
  d.main.updateMatrixWorld(true); d.sector.updateMatrixWorld(true);
  // seam polylines: per (gore, side) the front-face vertices of all tier cards, world space
  const seams = new Map();
  for (const an of [...S.anchorsOf(d.main), ...S.anchorsOf(d.sector)]) {
    const ud = an.userData; if (ud.part !== 'tier') continue;
    const g = geoOf(ud); const P = g.attributes.position; const C = g.attributes.color; const N = g.attributes.normal;
    for (let i = 0; i < P.count; i++) {
      if (C.getX(i) !== 1 || N.getZ(i) <= 0) continue; // front (outer) printed face only
      const key = ud.gore + (P.getX(i) > 0 ? 'R' : 'L');
      v.fromBufferAttribute(P, i).applyMatrix4(an.matrixWorld);
      if (!seams.has(key)) seams.set(key, []);
      seams.get(key).push([v.y, Math.hypot(v.x - c.x, v.z - c.z)]);
    }
  }
  const perRow = [];
  for (const [u, rt] of S.PROFILE) {
    if (u > 0.95) continue;
    const want = rt * S.R; const y = u * S.H;
    let lo = Infinity; let hi = -Infinity;
    for (const pts of seams.values()) {
      pts.sort((a, b) => a[0] - b[0]);
      let r = null;
      if (y <= pts[0][0]) r = pts[0][1];
      else for (let k = 1; k < pts.length; k++) if (pts[k][0] >= y) { const [y0, r0] = pts[k - 1]; const [y1, r1] = pts[k]; r = r0 + (r1 - r0) * (y - y0) / Math.max(1e-9, y1 - y0); break; }
      const e = (r - want) / want * 100; lo = Math.min(lo, e); hi = Math.max(hi, e);
    }
    worst = Math.max(worst, Math.abs(lo), Math.abs(hi));
    perRow.push({ u, r_table: rt, want_units: +want.toFixed(3), err_min_pct: +lo.toFixed(2), err_max_pct: +hi.toFixed(2) });
  }
  rows.push({ id: c.id, perRow, seams: seams.size,
    centre_units: [ +c.x.toFixed(3), +c.z.toFixed(3) ],
    centre_ft_from_units: [ +(d.main.position.x * S.UNIT_FT).toFixed(2), +(-d.main.position.z * S.UNIT_FT).toFixed(2) ],
    site_ft: (({ x, y }) => [x, y])(SITE.domes.find((s) => s.id === c.id)),
    order: [...fm.flaps].sort((a, b) => b.tUp - a.tUp).slice(0, 3).map((f) => `${f.node.name} tUp=${f.tUp.toFixed(3)}`),
    capLast: fm.flaps.every((f) => f.node.userData.part === 'cap' || f.tUp < fm.flaps.find((q) => q.node.userData.part === 'cap').tUp),
    capFirstDown: fm.flaps.find((q) => q.node.userData.part === 'cap').tDown === 0,
  });
}
console.log('Gores', S.N_GORES, '| flat-gore mid-line loss', ((1 - Math.cos(Math.PI / S.N_GORES)) * 100).toFixed(2) + '%', '| 1 unit =', S.UNIT_FT, 'ft');
console.table(rows[0].perRow);
for (const r of rows) {
  const errs = r.perRow.flatMap((p) => [p.err_min_pct, p.err_max_pct]);
  console.log(`${r.id}: seams=${r.seams} radius err range ${Math.min(...errs).toFixed(2)}..${Math.max(...errs).toFixed(2)} % | centre units ${r.centre_units} -> ft ${r.centre_ft_from_units} vs SITE ${r.site_ft} | cap last up: ${r.capLast}, first down: ${r.capFirstDown}`);
  console.log('   last to rise:', r.order.join(' ; '));
}
console.log('WORST |err| over all domes, seams, rows u<=0.95:', worst.toFixed(2) + '%', worst <= 3 ? 'PASS' : 'FAIL');

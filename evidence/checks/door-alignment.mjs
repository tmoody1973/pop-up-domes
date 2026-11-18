// Door alignment check (issue #10): does the visible dome doorway sit where the collider leaves its gap?
// Builds every dome from app/src at rest (risen, as door-gore-radius.mjs), finds each doorway card (base ring 'ring:d<k>'
// and lowest tier 'tier0:d<k>'), takes the centre of the gap cut in that card, and measures its sideways offset (ft,
// along the ring) from the collision doorway centre that world/collide.js derives (createCollider().shapes.domes[].doors).
// Goal (issue #10): every visible opening within 0.3 ft of its collision gap. Exits 1 when any door is over.
// Run: cd app && npm ci && node ../evidence/checks/door-alignment.mjs
const APP = new URL('../../app/', import.meta.url);
const THREE = await import(new URL('node_modules/three/build/three.module.js', APP));
const S = await import(new URL('src/world/domes/shell.js', APP));
const { createFoldInstance } = await import(new URL('src/world/fold.js', APP));
const { createCollider } = await import(new URL('src/world/collide.js', APP));

const LIMIT_FT = 0.3;
const geos = S.buildGeometries();
const collider = createCollider({ site: new THREE.Object3D() }); // dome doorways need no site pieces
const wrap = (a) => a - Math.round(a / (2 * Math.PI)) * 2 * Math.PI;

function risenAnchors(c) {
  const d = S.buildDome(geos, c.id);
  d.main.position.set(c.x, 0, c.z); d.sector.position.set(c.x, 0, c.z);
  createFoldInstance(d.main, { tileId: c.id, staggerSpan: S.STAGGER_SPAN }).snap(1);
  createFoldInstance(d.sector, { tileId: c.id + '_cut', staggerSpan: S.STAGGER_SPAN }).snap(1);
  d.main.updateMatrixWorld(true); d.sector.updateMatrixWorld(true);
  return [...S.anchorsOf(d.main), ...S.anchorsOf(d.sector)];
}

/** Card-local centre of the door gap / notch: along the card's bottom edge the x values are
 * [card edge, jamb, jamb, card edge]; the gap is the span between the two jambs. Returned at mid card height. */
function gapCentre(geo) {
  const P = geo.attributes.position;
  if (!geo.boundingBox) geo.computeBoundingBox();
  const { min, max } = geo.boundingBox;
  const xs = [...new Set(Array.from({ length: P.count }, (_, i) => i)
    .filter((i) => P.getY(i) < min.y + 0.01).map((i) => +P.getX(i).toFixed(5)))].sort((a, b) => a - b);
  if (xs.length !== 4) throw new Error(`door card bottom edge: expected 4 x values, got ${xs.join(', ')}`);
  return new THREE.Vector3((xs[1] + xs[2]) / 2, (min.y + max.y) / 2, 0);
}

let worst = 0; let n = 0; let over = 0; let missing = 0;
for (const c of S.domeCentres()) {
  const cd = collider.shapes.domes.find((d) => d.id === c.id);
  const anchors = risenAnchors(c);
  for (const dr of S.doorsOf(c)) {
    const colBearing = cd.doors.reduce((b, a) => (Math.abs(wrap(a - dr.bearing)) < Math.abs(wrap(b - dr.bearing)) ? a : b));
    for (const part of ['ring', 'tier0']) {
      const an = anchors.find((a) => a.userData.gore === dr.gore && a.userData.geo === part + ':' + dr.key);
      if (!an) { missing++; console.log(`  MISSING ${c.id} ${part} door card gore ${dr.gore} ${dr.key}`); continue; }
      const p = gapCentre(geos.byKey.get(an.userData.geo)).applyMatrix4(an.matrixWorld);
      const r = Math.hypot(p.x - c.x, p.z - c.z);
      const offFt = r * Math.sin(wrap(Math.atan2(p.z - c.z, p.x - c.x) - colBearing)) * S.UNIT_FT;
      n++; worst = Math.max(worst, Math.abs(offFt)); if (Math.abs(offFt) > LIMIT_FT) over++;
      console.log(`  ${c.id.padEnd(9)} ${part.padEnd(5)} gore ${String(dr.gore).padStart(2)} bearing ${(dr.bearing * 180 / Math.PI).toFixed(1).padStart(6)} deg  visible-vs-collision offset ${offFt.toFixed(2).padStart(6)} ft${Math.abs(offFt) > LIMIT_FT ? '  OVER' : ''}`);
    }
  }
}
console.log(`Door cards measured: ${n}; worst |offset| ${worst.toFixed(2)} ft; limit ${LIMIT_FT} ft`);
const pass = over === 0 && missing === 0 && n > 0;
console.log(pass ? 'PASS' : `FAIL (${over} over limit, ${missing} missing)`);
process.exit(pass ? 0 : 1);

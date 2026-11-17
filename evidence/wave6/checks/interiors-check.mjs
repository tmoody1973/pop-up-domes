// wave6-Q: walk / pond / doorway-connectivity check of the interior planting (reuses wave3-H paths-check logic) +
// card counts per dome (placements and card planes; crossed cards are two planes). Usage: node interiors-check.mjs
import fs from 'node:fs';
const P = await import('/Users/tarikmoody/Projects/domes/app/src/world/interiors/plans.js');
const W = await import('/Users/tarikmoody/Projects/domes/app/src/world/interiors/paths.js');
const atlas = JSON.parse(fs.readFileSync('/Users/tarikmoody/Projects/domes/app/public/textures/art/atlas.json'));
let bad = 0;
for (const id of ['show', 'desert', 'tropical']) {
  const net = W.network(id); const L = P.layout(id, atlas); const ponds = P.pondsOf(id);
  const onWalk = L.filter((c) => W.pathDistance(net, c.x, c.z) < W.PATH_HALF + c.rad);
  const inPond = L.filter((c) => ponds.some((p) => Math.hypot(c.x - p.x, c.z - p.z) < p.rad));
  const pondOnWalk = ponds.filter((p) => W.pathDistance(net, p.x, p.z) < W.PATH_HALF + p.rad);
  const doors = W.doorConnectivity(id);
  const planes = L.reduce((n, c) => n + (c.cross ? 2 : 1), 0);
  const missing = P.PLANS[id].hero.filter((k) => !L.some((c) => c.s === k.s)).map((k) => k.s);
  const counts = {}; for (const c of L) counts[c.s] = (counts[c.s] || 0) + 1;
  const tall = L.filter((c) => c.h >= 2).length; const mid = L.filter((c) => c.h >= 0.6 && c.h < 2).length; const low = L.length - tall - mid;
  console.log(`${id}: placements ${L.length}, card planes ${planes} (low<0.6u ${low} / mid ${mid} / tall>=2u ${tall}); on a walk ${onWalk.length}, in a pond ${inPond.length}, ponds on a walk ${pondOnWalk.length}, hero sprites not placed ${JSON.stringify(missing)}`);
  console.log('  doors', JSON.stringify(doors));
  console.log('  props', JSON.stringify(counts));
  bad += onWalk.length + inPond.length + pondOnWalk.length + doors.filter((d) => !d.connected).length;
}
console.log(bad ? `FAIL (${bad})` : 'PASS: no card on a walk or in a pond, every doorway connected');

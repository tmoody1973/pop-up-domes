// wave3-H: path network + planting checks (Node, pure modules). Prints door connectivity, cards on walks / in ponds,
// card counts per dome, and writes the traced polylines (normalised, v = north) for the plan overlay (overlay.py).
import fs from 'node:fs';
const P = await import('/Users/tarikmoody/Projects/domes/app/src/world/interiors/plans.js');
const W = await import('/Users/tarikmoody/Projects/domes/app/src/world/interiors/paths.js');
const atlas = JSON.parse(fs.readFileSync('/Users/tarikmoody/Projects/domes/app/public/textures/art/atlas.json'));
const dump = {};
for (const id of ['show', 'desert', 'tropical']) {
  const net = W.network(id); const L = P.layout(id, atlas); const ponds = P.pondsOf(id);
  const onWalk = L.filter((c) => W.pathDistance(net, c.x, c.z) < W.PATH_HALF + c.rad);
  const inPond = L.filter((c) => ponds.some((p) => Math.hypot(c.x - p.x, c.z - p.z) < p.rad));
  const pondOnWalk = ponds.filter((p) => W.pathDistance(net, p.x, p.z) < W.PATH_HALF + p.rad);
  const counts = {}; for (const c of L) counts[c.s] = (counts[c.s] || 0) + 1;
  console.log(`${id}: cards ${L.length}, on a walk ${onWalk.length}, in a pond ${inPond.length}, ponds on a walk ${pondOnWalk.length}`);
  console.log('  doors', JSON.stringify(W.doorConnectivity(id)));
  console.log('  props', JSON.stringify(counts));
  dump[id] = { trace: net.trace, spurs: net.spurs.map((s) => s.map(([x, z]) => [x / 5.425, -z / 5.425])), ponds: P.PLANS[id].floor.ponds };
}
fs.writeFileSync(new URL('./paths.json', import.meta.url), JSON.stringify(dump));

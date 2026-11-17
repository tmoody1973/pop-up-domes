// wave3-H evidence: headless system Chrome (GPU) via playwright-core. Screenshots h1-h3 (traveller inside each dome,
// cutaway open), biome table, draw calls (one interior open vs none, same view), console errors.
// Usage: node shots.mjs [poseDistance]   (dev server on http://127.0.0.1:5199)
import { createRequire } from 'node:module';
const require = createRequire('/Users/tarikmoody/node_modules/');
const { chromium } = require('playwright-core');
const OUT = '/Users/tarikmoody/Projects/domes/evidence/wave3/';
const dist = +(process.argv[2] || 30);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1512, height: 762 }, deviceScaleFactor: 2 });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await page.goto('http://127.0.0.1:5199/?debug=1&hint=0&mute=1&quality=med');
await page.waitForFunction(() => window.__domes && window.__interiors, null, { timeout: 90000 });
await page.waitForTimeout(4000);

const goInside = (id, d) => page.evaluate(async ([id, d]) => {
  const D = window.__domes; const dome = D.domes.domes.find((k) => k.id === id);
  // rise by distance (null): with every dome forced up, the follow camera south of the Desert Dome sits inside the
  // risen Tropical shell and films its gores (LOG.md [wave3-H])
  D.domes.override.rise = null; D.domes.override.cut = null;
  // stand ON the traced walk: its vertex nearest a point 0.6 units south of the centre (clear of the folded cutaway stack)
  const W = await import('/src/world/interiors/paths.js');
  let best = [0, 0]; let bd = 1e9;
  for (const line of W.network(id).polys) for (const [x, z] of line) { const q = Math.hypot(x, z - 0.6); if (q < bd) { bd = q; best = [x, z]; } }
  D.traveller.teleport(dome.x + best[0], dome.z + best[1]);
  if (D.follow.setPose) D.follow.setPose({ distance: d, pitchDeg: 50, yawDeg: 0, fov: 38 });
  D.follow.snap(D.traveller);
}, [id, d]);

const drawCalls = () => page.evaluate(() => new Promise((res) => {
  const R = window.__domes.renderer; R.info.autoReset = false; const calls = []; const tris = []; let n = 0;
  const f = () => { if (n++) { calls.push(R.info.render.calls); tris.push(R.info.render.triangles); } R.info.reset();
    if (n < 40) requestAnimationFrame(f); else { R.info.autoReset = true; const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1]; res({ calls: med(calls), triangles: med(tris) }); } };
  requestAnimationFrame(f);
}));

const result = { biome: [], drawCalls: {}, props: null };
for (const [i, id] of [[1, 'desert'], [2, 'show'], [3, 'tropical']]) {
  await goInside(id, dist);
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${OUT}h${i}-${id}.png` });
  result.biome.push(await page.evaluate(async (id) => {
    const B = await import('/src/core/biomes.js');
    const D = window.__domes; const dome = D.domes.domes.find((k) => k.id === id); const ts = D.CONFIG.TILE_SIZE || 2;
    const w = window.__interiors.daynight.grade.weights; let gi = 0; for (let b = 1; b < w.length; b++) if (w[b] > w[gi]) gi = b;
    const room = window.__interiors.rooms.find((r) => r.id === id);
    return { dome: id, biomeAt: B.biomeAt(0, dome.x / ts, dome.z / ts), index: B.biomeIndexAt(0, dome.x / ts, dome.z / ts), worldBiomeAt: D.world.biomeAt ? D.world.biomeAt(dome.x, dome.z) : null,
      gradeBiome: B.BIOMES[gi], gradeWeight: +w[gi].toFixed(3), interiorOpen: room.fold.target === 1, settled: room.fold.settled, inside: dome.inside };
  }, id));
  if (id === 'desert') {
    result.drawCalls.oneOpen = await drawCalls();
    await page.evaluate(() => { window.__domes.domes.override.cut = 0; });
    await page.waitForTimeout(4000);
    result.drawCalls.noneOpen = await drawCalls();
    result.drawCalls.batchVisibleWhenClosed = await page.evaluate(() => window.__interiors.batch.visible);
    await page.evaluate(() => { window.__domes.domes.override.cut = null; });
  }
}
// leaving: walk out of the tropical dome -> its interior folds and hides
await page.evaluate(() => { const D = window.__domes; const d = D.domes.domes.find((k) => k.id === 'tropical'); D.traveller.teleport(d.x, d.z + 9); });
await page.waitForTimeout(4000);
result.afterLeaving = await page.evaluate(() => window.__interiors.rooms.map((r) => ({ id: r.id, target: r.fold.target, settled: r.fold.settled, shown: r.shown })));
result.props = await page.evaluate(() => window.__interiors.debugProps().map((r) => ({ id: r.id, cards: r.cards, props: r.props.reduce((m, s) => ((m[s] = (m[s] || 0) + 1), m), {}) })));
console.log(JSON.stringify(result, null, 1));
console.log('console errors/warnings:', logs.length ? logs : 'none');
await browser.close();

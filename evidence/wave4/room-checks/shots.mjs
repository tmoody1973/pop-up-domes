// wave4-I evidence: headless system Chrome (GPU) via playwright-core (same pattern as wave3/interiors-checks/shots.mjs).
// Usage: node shots.mjs <tag> [shots=1]   (dev server on http://127.0.0.1:5199)
//   tag    = label for the metrics (e.g. before / after); shots=1 also writes i1 / i2 / i3 JPEGs (q80, <= 1600 px).
// Views: f1 = traveller on the Show-Desert link (the wave3 f1 spot, low dome-approach lens);
//        book = pulled-back whole-book pose; doors = lobby from the north-east (the doors facing the domes).
import { createRequire } from 'node:module';
const require = createRequire('/Users/tarikmoody/node_modules/');
const { chromium } = require('playwright-core');
const sharp = require('sharp');
const OUT = '/Users/tarikmoody/Projects/domes/evidence/wave4/';
const tag = process.argv[2] || 'run';
const doShots = (process.argv[3] ?? '1') === '1';
const SUFFIX = process.env.SUFFIX || ''; // e.g. -before: written next to the deliverables
const QS = process.env.QS || ''; // extra URL params, e.g. &dusk=1

const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 727 }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await page.goto((process.env.BASE || 'http://127.0.0.1:5199') + '/?debug=1&hint=0&mute=1&quality=med' + QS);
await page.waitForFunction(() => window.__domes && window.__domes.world, null, { timeout: 90000 });
await page.waitForTimeout(4000);

const shot = async (name) => {
  if (!doShots) return;
  const png = await page.screenshot();
  await sharp(png).resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 80 }).toFile(OUT + name.replace('.jpg', SUFFIX + '.jpg'));
};
// median draw calls / triangles and rAF frame-time percentiles over 120 frames
const metrics = () => page.evaluate(() => new Promise((res) => {
  const R = window.__domes.renderer; R.info.autoReset = false; const calls = []; const tris = []; const dts = []; let n = 0; let t0 = 0;
  const f = (t) => {
    if (n++) { calls.push(R.info.render.calls); tris.push(R.info.render.triangles); dts.push(t - t0); }
    t0 = t; R.info.reset();
    if (n < 121) requestAnimationFrame(f);
    else {
      R.info.autoReset = true;
      const q = (a, p) => [...a].sort((x, y) => x - y)[Math.floor(a.length * p)];
      res({ calls: q(calls, 0.5), triangles: q(tris, 0.5), p50ms: +q(dts, 0.5).toFixed(2), p95ms: +q(dts, 0.95).toFixed(2) });
    }
  };
  requestAnimationFrame(f);
}));
const place = (x, z, pose) => page.evaluate(([x, z, pose]) => {
  const D = window.__domes;
  D.follow.setPose(pose);
  D.traveller.teleport(x, z);
  D.follow.snap(D.traveller);
}, [x, z, pose]);

const result = { tag };
// f1: the Show-Desert link, centre (84.5 ft, 0) = (7.04, 0), default pose (the dome approach blend lowers the lens)
await place(7.04, 0, null);
await page.waitForTimeout(7000);
result.f1 = await metrics();
result.f1.cam = await page.evaluate(() => { const c = window.__domes.follow.camera; return { pos: c.position.toArray().map((v) => +v.toFixed(2)), pitch: +window.__domes.state.camPitch.toFixed(1) }; });
result.f1.site = await page.evaluate(() => window.__domes.world.site.debugPieces().map((p) => p.piece + ':' + (p.fade ?? '-')).join(' '));
await shot('i1-approach-desert.jpg');

// whole book: traveller on the lawn west of the Show Dome, camera pulled far back (no dome mix out here)
const bk = await page.evaluate(() => { const b = window.__domes.siteMap.page(window.__domes.CONFIG.TILE_SIZE || 2); return { x: b.x, z: b.z, hw: b.halfWidth, hd: b.halfDepth }; });
result.bookRect = bk;
await page.evaluate(() => { window.__domes.domes.override.rise = 1; }); // all three domes up (the camera is far outside them)
await place(bk.x - bk.hw + 3, bk.z + bk.hd - 3, { distance: 52, pitchDeg: 33, yawDeg: 0, fov: 40, screenUp: bk.hd - 4, screenRight: bk.hw - 5, targetHeight: 0, lookAhead: 0, domeMix: 0 });
await page.waitForTimeout(7000);
result.book = await metrics();
await shot('i2-whole-book.jpg');
await page.evaluate(() => { window.__domes.domes.override.rise = null; });

// lobby doors: traveller north-east of the lobby (in the Desert-side approach), camera looking at the NE / NW walls
await page.evaluate(() => { window.__domes.world.site.debugForce(1); window.__domes.domes.override.rise = 0; });
await place(7.04, 2.4, { distance: 9.5, pitchDeg: 32, yawDeg: 180, fov: 34, targetHeight: 0.6, lookAhead: 0, screenUp: 2.6, domeMix: 0 });
await page.waitForTimeout(6000);
await shot('i3-lobby-doors.jpg');
result.doors = await metrics();
result.doorsSite = await page.evaluate(() => window.__domes.world.site.debugPieces().map((p) => p.piece + ':' + p.fade).join(' '));
await page.evaluate(() => { window.__domes.world.site.debugForce(null); window.__domes.domes.override.rise = null; });

console.log(JSON.stringify(result, null, 1));
console.log('console errors/warnings:', logs.length ? logs : 'none');
await browser.close();

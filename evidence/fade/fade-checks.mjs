// [fade] evidence: is the traveller visible when something stands between him and the lens?
// Usage: BASE=http://127.0.0.1:5350 node fade-checks.mjs <tag> [shots=1]   (private vite preview of the build)
// Views: a = inside the Tropical dome, north part (planting between him and the camera);
//        b = just north of the Desert dome, outside (the dome between him and the camera);
//        c = just north of the entrance arcade (the arcade between him and the camera).
// Per view: raycast camera -> head / feet (what lies on the line, with its fade), traveller pixels on screen
// (screenshot with him shown vs hidden, changed pixels inside his projected box), faded-card counts, draw calls and
// rAF frame-time p50 / p95 over 120 frames.
import { createRequire } from 'node:module';
const require = createRequire('/Users/tarikmoody/node_modules/');
const { chromium } = require('playwright-core');
const sharp = require('sharp');
const OUT = '/Users/tarikmoody/Projects/domes/evidence/fade/';
const tag = process.argv[2] || 'run';
const doShots = (process.argv[3] ?? '1') === '1';

const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 727 }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await page.route('**/__three/**', (r) => r.fulfill({ path: '/Users/tarikmoody/Projects/domes/app/node_modules/three/build/' + r.request().url().split('/__three/')[1], contentType: 'text/javascript' }));
await page.goto((process.env.BASE || 'http://127.0.0.1:5350') + '/?debug=1&hint=0&mute=1&quality=med');
await page.waitForFunction(() => window.__domes && window.__domes.state, null, { timeout: 90000 });
await page.waitForTimeout(4000);

const metrics = () => page.evaluate(() => new Promise((res) => {
  const R = window.__domes.renderer; R.info.autoReset = false; const calls = []; const dts = []; let n = 0; let t0 = 0;
  const f = (t) => {
    if (n++) { calls.push(R.info.render.calls); dts.push(t - t0); }
    t0 = t; R.info.reset();
    if (n < 121) requestAnimationFrame(f);
    else {
      R.info.autoReset = true;
      const q = (a, p) => [...a].sort((x, y) => x - y)[Math.floor(a.length * p)];
      res({ calls: q(calls, 0.5), p50ms: +q(dts, 0.5).toFixed(2), p95ms: +q(dts, 0.95).toFixed(2) });
    }
  };
  requestAnimationFrame(f);
}));
const place = (x, z) => page.evaluate(([x, z]) => {
  const D = window.__domes; D.traveller.teleport(x, z); D.follow.snap(D.traveller);
}, [x, z]);
const frames = (n) => page.evaluate((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

// what lies on the camera -> head / feet lines (and, after the change, how faded it is)
const rays = () => page.evaluate(() => {
  const D = window.__domes; const cam = D.follow.camera; const t = D.traveller.position; const I = window.__interiors;
  const V = cam.position.constructor; const out = [];
  const RC = window.__RC;
  for (const h of [0.1, 0.55]) {
    const tgt = new V(t.x, t.y + h, t.z); const dir = tgt.clone().sub(cam.position); const len = dir.length(); dir.normalize();
    const rc = new RC(cam.position.clone(), dir, 0.01, len - 0.05); rc.camera = cam;
    const hs = rc.intersectObjects(D.scene.children, true).filter((x) => { let o = x.object; while (o) { if (o.name === 'traveller-root') return false; o = o.parent; } return true; });
    const seen = new Set();
    for (const x of hs) {
      const id = x.batchId; const key = x.object.name + (id !== undefined ? '#' + id : '');
      if (seen.has(key)) continue; seen.add(key);
      let fade = null;
      if (x.object.name === 'dome-interiors' && I) for (const r of I.rooms) { const k = r.ids.indexOf(id); if (k >= 0 && r.fader) fade = +r.fader.fade[k].toFixed(2); }
      if (x.object.name === 'domes') for (const d of D.domes.domes) { const ids = [...d.ids[0], ...d.ids[1]]; const k = ids.indexOf(id); if (k >= 0 && d.fader) fade = +d.fader.fade[k].toFixed(2); }
      if (fade === null) { let o = x.object; while (o && o.parent && o.parent.name !== 'site') o = o.parent; if (o && o.parent) { const p = D.world.site.debugPieces().find((q) => q.piece === o.name); if (p) fade = p.fade; } }
      out.push({ h, hit: key, fade });
    }
  }
  return out;
});

// traveller pixels: screenshot shown vs hidden, count changed pixels inside his projected box
async function travellerPixels(name) {
  const box = await page.evaluate(() => {
    const D = window.__domes; const cam = D.follow.camera; const t = D.traveller.position; const V = cam.position.constructor;
    const right = new V().setFromMatrixColumn(cam.matrixWorld, 0);
    const pts = [];
    for (const h of [0.05, 0.62]) for (const s of [-0.22, 0.22]) pts.push(new V(t.x, t.y + h, t.z).addScaledVector(right, s).project(cam));
    const W = innerWidth; const H = innerHeight;
    const xs = pts.map((p) => (p.x + 1) / 2 * W); const ys = pts.map((p) => (1 - p.y) / 2 * H);
    return { x: Math.max(0, Math.floor(Math.min(...xs))), y: Math.max(0, Math.floor(Math.min(...ys))), x1: Math.min(W, Math.ceil(Math.max(...xs))), y1: Math.min(H, Math.ceil(Math.max(...ys))) };
  });
  const shotRaw = async () => sharp(await page.screenshot()).raw().toBuffer({ resolveWithObject: true });
  await frames(3);
  const shown = await shotRaw();
  await page.evaluate(() => { window.__domes.traveller.group.visible = false; });
  await frames(3);
  const hidden = await shotRaw();
  await page.evaluate(() => { window.__domes.traveller.group.visible = true; });
  await frames(3);
  const { width, channels } = shown.info;
  let changed = 0; let total = 0;
  for (let y = box.y; y < box.y1; y++) for (let x = box.x; x < box.x1; x++) {
    const i = (y * width + x) * channels; total++;
    const d = Math.abs(shown.data[i] - hidden.data[i]) + Math.abs(shown.data[i + 1] - hidden.data[i + 1]) + Math.abs(shown.data[i + 2] - hidden.data[i + 2]);
    if (d > 24) changed++;
  }
  if (doShots) await sharp(await page.screenshot()).resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 80 }).toFile(OUT + name + (tag === 'after' ? '' : '-' + tag) + '.jpg');
  return { box, travellerPx: changed, boxPx: total };
}

// three is bundled (no window.THREE): load a second copy of its core from node_modules just for the Raycaster.
// Object3D.raycast only duck-types raycaster.ray, so a Raycaster from another copy hits the app's meshes fine.
// (window.__THREE__ is parked meanwhile so the second copy does not log its 'multiple instances' warning)
await page.evaluate(() => { window.__T0 = window.__THREE__; delete window.__THREE__; });
await page.addScriptTag({ type: 'module', content: "import { Raycaster } from '/__three/three.core.js'; window.__RC = Raycaster;" });
await page.waitForFunction(() => window.__RC);
await page.evaluate(() => { window.__THREE__ = window.__T0; });

const result = { tag };
const D = await page.evaluate(() => ({ domes: window.__domes.domes.domes.map((d) => ({ id: d.id, x: d.x, z: d.z })) }));
result.domes = D.domes;
const trop = D.domes.find((d) => /trop/i.test(d.id)); const desert = D.domes.find((d) => /des/i.test(d.id));
const R0 = 5.4; // ~ base ring radius
const arc = await page.evaluate(() => {
  const D = window.__domes; const a = D.scene.getObjectByName('arcade'); const V = D.follow.camera.position.constructor;
  a.updateMatrixWorld(true);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; const v = new V();
  a.traverse((o) => { if (!o.isMesh) return; const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i += 7) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z); } });
  return { x: (x0 + x1) / 2, z0, z1 };
});
result.arcade = arc;

const views = {
  a: [trop.x, trop.z - R0 * 0.55],
  b: [desert.x, desert.z - R0 - 0.9],
  c: [arc.x, arc.z0 - 0.5],
};
for (const [k, [x, z]] of Object.entries(views)) {
  await place(x, z);
  await page.waitForTimeout(6500);
  const v = { at: [+x.toFixed(2), +z.toFixed(2)] };
  v.cam = await page.evaluate(() => window.__domes.follow.camera.position.toArray().map((n) => +n.toFixed(2)));
  v.rays = await rays().catch((e) => 'raycast failed: ' + e.message);
  v.faded = await page.evaluate(() => ({
    domes: window.__domes.domes.debugFaded ? window.__domes.domes.debugFaded() : null,
    interiors: window.__interiors && window.__interiors.debugFaded ? window.__interiors.debugFaded() : null,
    site: window.__domes.world.site.debugPieces().filter((p) => p.fade).map((p) => p.piece + ':' + p.fade).join(' '),
  }));
  v.px = await travellerPixels({ a: 'a-tropical-planting', b: 'b-north-of-desert', c: 'c-behind-arcade' }[k]);
  v.metrics = await metrics();
  result[k] = v;
}
console.log(JSON.stringify(result, null, 1));
console.log('console errors/warnings:', logs.length ? logs : 'none');
await browser.close();

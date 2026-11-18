// Root-cause probe: BatchedMesh rebuilds + re-uploads its draw-list (indirect) texture before EVERY pass (shadow, main).
// Variants toggled at runtime, interleaved, per view. Usage: node probe-batch.mjs <start|book|tropical>
import { createRequire } from 'node:module';
const require = createRequire('/Users/tarikmoody/node_modules/');
const { chromium } = require('playwright-core');
const view = process.argv[2] || 'tropical';
const VIEWS = { start: { q: '' }, book: { q: 'dusk=1', zoom: true }, tropical: { q: 'dusk=1', x: 13.256, z: 13.285 } };
const V0 = VIEWS[view];
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--use-angle=metal', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage();
await page.goto('http://127.0.0.1:5360/?debug=1&hint=0&mute=1&quality=med&' + V0.q);
await page.waitForFunction(() => window.__domes && window.__interiors, null, { timeout: 90000 }); await page.waitForTimeout(1500);
await page.evaluate((V0) => { const D = window.__domes; if (V0.x) { D.traveller.teleport(V0.x, V0.z); D.follow.snap(D.traveller); } if (V0.zoom) D.follow.zoomBy(100); }, V0);
await page.waitForTimeout(5000);
const out = await page.evaluate(async () => {
  const D = window.__domes; const wait = (ms) => new Promise((s) => setTimeout(s, ms));
  const batches = []; D.scene.traverse((o) => { if (o.isBatchedMesh) batches.push(o); });
  const byName = (n) => batches.filter((b) => b.name.startsWith(n));
  const save = new Map(batches.map((b) => [b, [b.perObjectFrustumCulled, b.sortObjects, b.onBeforeRender, b.onBeforeShadow]]));
  const restore = () => { for (const [b, s] of save) { [b.perObjectFrustumCulled, b.sortObjects, b.onBeforeRender, b.onBeforeShadow] = s; b._visibilityChanged = true; } };
  const once = (b) => { let f = -1; const up = (g, m) => { if (D.state.frame === f) return; f = D.state.frame; b._updateDrawParameters(D.follow.camera, g, m); };
    b.perObjectFrustumCulled = false; b.onBeforeRender = (r, s, c, g, m) => up(g, m); b.onBeforeShadow = (r, o, c, sc, g, m) => up(g, m); };
  const stat = (b) => { b.perObjectFrustumCulled = false; b.sortObjects = false; b._visibilityChanged = true; };
  const med = (a) => { const s = a.slice().sort((x, y) => x - y); return +s[s.length >> 1].toFixed(2); };
  const p95 = (a) => { const s = a.slice().sort((x, y) => x - y); return +s[Math.floor(s.length * 0.95)].toFixed(2); };
  const run = () => new Promise((res) => { const f = []; let last = 0; const t0 = performance.now(); const tick = (t) => { if (last) f.push(t - last); last = t; if (t - t0 < 4000) requestAnimationFrame(tick); else res([med(f), p95(f)]); }; requestAnimationFrame(tick); });
  const V = {
    base: () => {},
    interiorsStatic: () => byName('dome-interiors').forEach(stat),
    interiorsNoSortOnly: () => byName('dome-interiors').forEach((b) => { b.sortObjects = false; }),
    interiorsNoCullOnly: () => byName('dome-interiors').forEach((b) => { b.perObjectFrustumCulled = false; }),
    plusTilesNoCull: () => { byName('dome-interiors').forEach(stat); byName('tiles').forEach(stat); },
    plusDomesOnce: () => { byName('dome-interiors').forEach(stat); byName('tiles').forEach(stat); byName('domes').forEach(once); },
    allStatic: () => batches.forEach(stat),
  };
  const res = { batches: batches.map((b) => b.name + ':' + b.instanceCount + (b.perObjectFrustumCulled ? ':cull' : '') + (b.sortObjects ? ':sort' : '')) };
  for (let rep = 0; rep < 3; rep++) for (const [k, on] of Object.entries(V)) { on(); await wait(1200); (res[k] ||= []).push(await run()); restore(); await wait(800); }
  return res;
});
console.log(view, JSON.stringify(out));
await browser.close();

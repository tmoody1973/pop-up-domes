// [wave5-L] Fidelity (f) performance: headless system Chrome (ANGLE Metal, vsync + frame-rate limit off), private
// vite-preview snapshot, 1512 x 762 @2x, ?quality=med&dusk=1, k1 framing (all three domes + lobby + arcade in view),
// domes forced up. Two 10 s windows per condition: (1) rAF interval p50/p95/p99 + renderer.info draw calls / triangles;
// (2) per-frame busy time = the app's rAF callback wall time + gl.finish() (CPU submit + GPU drain, not vsync-bound).
// Conditions: domes on, and ?domes=0 at the same view (the closest available stand-in for the papertrails baseline:
// the original countryside world no longer exists in this tree). Usage: node perf.mjs   (BASE env, default :5310)
import { createRequire } from 'node:module';
const require = createRequire('/Users/tarikmoody/node_modules/');
const { chromium } = require('playwright-core');
const BASE = process.env.BASE || 'http://127.0.0.1:5310/';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const logs = []; const out = {};
for (const q of ['quality=med&dusk=1', 'quality=med&dusk=1&domes=0']) {
  const page = await browser.newPage({ viewport: { width: 1512, height: 762 }, deviceScaleFactor: +(process.env.DPR || 2) });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(q + ' ' + m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => logs.push(q + ' pageerror: ' + e.message));
  await page.addInitScript(() => {
    const raw = window.requestAnimationFrame.bind(window); window.__rawRAF = raw; window.__busy = []; window.__rec = false; window.__finish = false;
    window.requestAnimationFrame = (cb) => raw((t) => { const s = performance.now(); cb(t);
      if (window.__finish && window.__gl) window.__gl.finish(); if (window.__rec) window.__busy.push(performance.now() - s); });
  });
  await page.goto(BASE + '?debug=1&hint=0&mute=1&' + q);
  await page.waitForFunction(() => window.__domes, null, { timeout: 90000 });
  await page.waitForTimeout(4000);
  const pose = () => page.evaluate(() => { const D = window.__domes; if (D.domes) D.domes.override.rise = 1; D.CONFIG.world.viewReachMax = 16;
    D.traveller.teleport(4.2, 9.4); D.follow.setPose({ distance: 40, pitchDeg: 42, yawDeg: -45, fov: 38, domeMix: 0 }); D.follow.snap(D.traveller); });
  await pose(); await page.waitForTimeout(1500); await pose(); await page.waitForTimeout(8000);
  const r = await page.evaluate(() => new Promise((res) => {
    const D = window.__domes; const R = D.renderer; window.__gl = R.getContext(); R.info.autoReset = false;
    const gl = window.__gl; const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '?';
    const dts = []; const calls = []; const tris = []; let last = 0; const t0 = performance.now();
    const stats = (a) => { const s = [...a].sort((x, y) => x - y); const p = (q) => +s[Math.min(s.length - 1, Math.floor(q * s.length))].toFixed(2);
      return { n: a.length, mean: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2), p50: p(0.5), p95: p(0.95), p99: p(0.99), max: +s.at(-1).toFixed(2) }; };
    const f = (t) => {
      if (last) { dts.push(t - last); calls.push(R.info.render.calls); tris.push(R.info.render.triangles); }
      R.info.reset(); last = t;
      if (t - t0 < 10000) { window.__rawRAF(f); return; }
      R.info.autoReset = true;
      const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
      const first = { raf_ms: stats(dts), drawCalls_median: med(calls), drawCalls_max: Math.max(...calls), triangles_median: med(tris), gpu,
        risen: D.domes ? D.domes.domes.map((d) => d.id + ':' + (d.folds[0].settled && d.want)) : 'domes=0' };
      // window 2: busy time with gl.finish
      window.__busy = []; window.__finish = true; window.__rec = true;
      setTimeout(() => { window.__rec = false; window.__finish = false; res({ ...first, busy_finish_ms: stats(window.__busy) }); }, 10000);
    };
    window.__rawRAF(f);
  }));
  out[q] = r;
  await page.close();
}
const on = out['quality=med&dusk=1']; const off = out['quality=med&dusk=1&domes=0'];
console.log(JSON.stringify(out, null, 1));
console.log('draw calls domes on / domes=0:', on.drawCalls_median, '/', off.drawCalls_median, '=', (on.drawCalls_median / off.drawCalls_median).toFixed(2) + 'x');
console.log('console errors/warnings:', logs.length ? logs : 'none');
await browser.close();

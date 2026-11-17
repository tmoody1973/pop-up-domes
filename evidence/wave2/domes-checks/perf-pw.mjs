// Perf + console capture in headless system Chrome (GPU) via playwright-core: ego-browser's unfocused window throttles rAF.
import { createRequire } from 'node:module';
const require = createRequire('/Users/tarikmoody/node_modules/');
const { chromium } = require('playwright-core');
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const page = await browser.newPage({ viewport: { width: 1512, height: 762 }, deviceScaleFactor: 2 });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
const out = {};
const mode = process.argv[2] || 'both';
for (const q of mode === 'both' ? ['quality=med&domes=0', 'quality=med'] : [mode]) {
  await page.goto('http://127.0.0.1:5199/?debug=1&hint=0&mute=1&' + q);
  await page.waitForFunction(() => window.__domes, null, { timeout: 60000 });
  await page.waitForTimeout(6000);
  const gpu = await page.evaluate(() => { const gl = document.createElement('canvas').getContext('webgl2'); const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; });
  await page.evaluate(() => {
    const D = window.__domes;
    if (D.domes) D.domes.override.rise = 1;
    D.CONFIG.world.viewReachMax = 14;
    D.traveller.teleport(9, 15);
    D.follow.setPose({ distance: 46, pitchDeg: 52, yawDeg: 0, fov: 38 });
    D.follow.snap(D.traveller);
  });
  await page.waitForTimeout(8000);
  out[q] = await page.evaluate(() => new Promise((res) => {
    const R = window.__domes.renderer; R.info.autoReset = false;
    const dts = []; const calls = []; const tris = []; let last = 0; const t0 = performance.now();
    const f = (t) => {
      if (last) { dts.push(t - last); calls.push(R.info.render.calls); tris.push(R.info.render.triangles); }
      R.info.reset(); last = t;
      if (t - t0 < 10000) requestAnimationFrame(f);
      else {
        R.info.autoReset = true;
        const s = [...dts].sort((a, b) => a - b); const pct = (p) => +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(2);
        const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
        const D = window.__domes;
        res({ frames: dts.length, mean_ms: +(dts.reduce((a, b) => a + b, 0) / dts.length).toFixed(2), p50_ms: pct(0.5), p95_ms: pct(0.95), p99_ms: pct(0.99),
          drawCalls_median: med(calls), triangles_median: med(tris), domesRisen: D.domes ? D.domes.domes.map((d) => d.folds.map((f) => f.settled && f.target)) : null });
      }
    };
    requestAnimationFrame(f);
  }));
  out[q].gpu = gpu;
}
console.log(JSON.stringify(out, null, 1));
console.log('console errors/warnings:', logs.length ? logs : 'none');
await browser.close();

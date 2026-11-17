import { createRequire } from 'node:module';
const require = createRequire('/Users/tarikmoody/node_modules/');
const { chromium } = require('playwright-core');
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const page = await browser.newPage({ viewport: { width: 1512, height: 762 }, deviceScaleFactor: 2 });
await page.goto('http://127.0.0.1:5199/?debug=1&hint=0&mute=1&quality=med');
await page.waitForFunction(() => window.__domes, null, { timeout: 60000 });
await page.waitForTimeout(6000);
await page.evaluate(() => { const D = window.__domes; D.domes.override.rise = 1; D.CONFIG.world.viewReachMax = 14; D.traveller.teleport(9, 15); D.follow.setPose({ distance: 46, pitchDeg: 52, yawDeg: 0, fov: 38 }); D.follow.snap(D.traveller); });
await page.waitForTimeout(8000);
const r = await page.evaluate(() => new Promise((res) => {
  const D = window.__domes; const b = D.domes.batch; const h = D.domes.halo; const R = D.renderer; R.info.autoReset = false;
  const on = []; const off = []; const callsOn = []; const callsOff = []; let last = 0; const t0 = performance.now(); let vis = true; let lastSwitch = t0; let skip = 2;
  const f = (t) => {
    if (last && skip <= 0) { (vis ? on : off).push(t - last); (vis ? callsOn : callsOff).push(R.info.render.calls); }
    skip--; R.info.reset(); last = t;
    if (t - lastSwitch > 1000) { vis = !vis; b.visible = vis; h.visible = vis; lastSwitch = t; skip = 2; }
    if (t - t0 < 20000) requestAnimationFrame(f);
    else {
      b.visible = h.visible = true; R.info.autoReset = true;
      const st = (a) => { const s = [...a].sort((x, y) => x - y); const p = (q) => +s[Math.min(s.length - 1, Math.floor(q * s.length))].toFixed(1); return { frames: a.length, p50: p(0.5), p95: p(0.95), mean: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) }; };
      const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
      res({ domesShown: { ...st(on), drawCalls: med(callsOn) }, domesHidden: { ...st(off), drawCalls: med(callsOff) } });
    }
  };
  requestAnimationFrame(f);
}));
console.log(JSON.stringify(r));
await browser.close();

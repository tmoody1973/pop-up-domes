// BASE=http://127.0.0.1:PORT/ to point at another server (A/B snapshots).
// wave4-K day regression: same pose as k1, grain off, life/animals off (no moving cards), PNG + the look tunables
// daynight writes (CONFIG.lights / post / dof / assets). Usage: node daycheck.mjs <out-prefix>
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire('/Users/tarikmoody/node_modules/');
const { chromium } = require('playwright-core');
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1512, height: 762 }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await page.goto((process.env.BASE || 'http://127.0.0.1:5199/') + '?debug=1&hint=0&mute=1&quality=med&life=0&animals=0');
await page.waitForFunction(() => window.__domes && window.__interiors, null, { timeout: 90000 });
await page.waitForTimeout(3000);
const setPose = () => page.evaluate(() => {
  const D = window.__domes; D.domes.override.rise = 1; D.CONFIG.world.viewReachMax = 14; D.CONFIG.post.grain = 0;
  D.traveller.teleport(3.0, 10.6); D.follow.setPose({ distance: 34, pitchDeg: 40, yawDeg: -45, fov: 38, domeMix: 0, driftAmp: 0 }); D.follow.snap(D.traveller);
});
await setPose(); await page.waitForTimeout(1500); await setPose();
await page.waitForTimeout(7000);
await page.screenshot({ path: out + '.png' });
const look = await page.evaluate(() => { const C = window.__domes.CONFIG; return JSON.stringify({ lights: C.lights, post: C.post, dof: C.dof, glow: C.assets.glowIntensity }); });
writeFileSync(out + '.json', look);
console.log(out, 'console errors/warnings:', logs.length ? logs : 'none');
await browser.close();

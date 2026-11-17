// wave4-K: one framed capture. Usage: node pose.mjs <out> <query> <x> <z> <dist> <pitch> [fov] [wait ms] [yaw]
import { createRequire } from 'node:module';
const require = createRequire('/Users/tarikmoody/node_modules/');
const { chromium } = require('playwright-core');
const [out, query, x, z, dist, pitch, fov = 38, wait = 7000, yaw = 0] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1512, height: 762 }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await page.goto((process.env.BASE || 'http://127.0.0.1:5199/') + '?debug=1&hint=0&mute=1&quality=med&' + query);
await page.waitForFunction(() => window.__domes && window.__interiors, null, { timeout: 90000 });
await page.waitForTimeout(3000);
const setPose = () => page.evaluate(([x, z, d, p, f, y]) => {
  const D = window.__domes; D.domes.override.rise = 1; D.CONFIG.world.viewReachMax = 14;
  D.traveller.teleport(x, z); D.follow.setPose({ distance: d, pitchDeg: p, yawDeg: y, fov: f, domeMix: 0 }); D.follow.snap(D.traveller);
}, [+x, +z, +dist, +pitch, +fov, +yaw]);
await setPose(); await page.waitForTimeout(1500); await setPose(); // twice: an early call is sometimes lost while the scene settles
await page.waitForTimeout(+wait);
const type = out.endsWith('.png') ? 'png' : 'jpeg';
await page.screenshot({ path: out, type, ...(type === 'jpeg' ? { quality: 80 } : {}) });
console.log(out, 'console errors/warnings:', logs.length ? logs : 'none');
await browser.close();

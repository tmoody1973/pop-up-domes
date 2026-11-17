import { createRequire } from 'node:module';
const require = createRequire('/Users/tarikmoody/node_modules/');
const { chromium } = require('playwright-core');
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const [label, base] of [['before', 'http://127.0.0.1:5362/'], ['after', 'http://127.0.0.1:5361/']]) for (const q of ['dusk=1', '']) {
  const page = await browser.newPage({ viewport: { width: 1376, height: 768 } });
  await page.goto(base + '?debug=1&hint=0&mute=1&quality=med&' + q);
  await page.waitForFunction(() => window.__domes && window.__interiors, null, { timeout: 90000 });
  await page.evaluate(() => { const D = window.__domes; D.domes.override.rise = 1; D.CONFIG.world.viewReachMax = 16; D.traveller.teleport(4.2, 9.4); D.follow.setPose({ distance: 40, pitchDeg: 42, yawDeg: -45, fov: 38, domeMix: 0 }); D.follow.snap(D.traveller); });
  await page.waitForTimeout(8000);
  const r = await page.evaluate(async () => { const R = window.__domes.renderer; const old = R.info.autoReset; R.info.autoReset = false; R.info.reset(); await new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f))); const c = R.info.render.calls; R.info.autoReset = old; return c; });
  console.log(label, q || 'day', 'draw calls/frame (2 rAF / 2):', r / 2);
  await page.close();
}
await browser.close();

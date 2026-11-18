// Forces the automatic step-down (CPU throttled 8x so the median frame > 28.6 ms) and checks every subsystem followed it.
import { createRequire } from 'node:module';
const require = createRequire('/Users/tarikmoody/node_modules/');
const { chromium } = require('playwright-core');
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--use-angle=metal'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto((process.env.BASE || 'http://127.0.0.1:5360/') + '?debug=1&hint=0&mute=1');
await page.waitForFunction(() => window.__domes && window.__domes.state, null, { timeout: 90000 });
const cdp = await page.context().newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 30 });
await page.waitForFunction(() => window.__domes.state.quality === 'low', null, { timeout: 60000 }).catch(() => {});
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
await page.waitForTimeout(1500);
const s = await page.evaluate(() => {
  const D = window.__domes; const key = D.scene.getObjectByName('key'); let taps = null;
  D.scene.traverse((o) => { const m = o.material; if (!taps && m && m.defines && m.defines.PAPER_BLOCKER_TAPS !== undefined) taps = [m.defines.PAPER_BLOCKER_TAPS, m.defines.PAPER_PCF_TAPS]; });
  return { quality: D.state.quality, dpr: D.renderer.getPixelRatio(), shadowMap: key.shadow.mapSize.x, taps };
});
console.log(JSON.stringify({ ...s, errors: errs }));
await browser.close();

// Visual check of a candidate setting before committing to it: same pose, setting A vs B, full-res crops.
import { createRequire } from 'node:module';
const require = createRequire('/Users/tarikmoody/node_modules/');
const { chromium } = require('playwright-core');
const [view = 'book', what = 'msaa0'] = process.argv.slice(2);
const VIEWS = { start: { q: '' }, book: { q: 'dusk=1', zoom: true }, tropical: { q: 'dusk=1', x: 13.256, z: 13.285 } };
const V0 = VIEWS[view];
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--use-angle=metal', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage();
await page.goto('http://127.0.0.1:5360/?debug=1&hint=0&mute=1&quality=med&' + V0.q);
await page.waitForFunction(() => window.__domes && window.__interiors, null, { timeout: 90000 }); await page.waitForTimeout(1500);
await page.evaluate((V0) => { const D = window.__domes; if (V0.x) { D.traveller.teleport(V0.x, V0.z); D.follow.snap(D.traveller); } if (V0.zoom) D.follow.zoomBy(100); }, V0);
await page.addStyleTag({ content: '#hint{display:none!important}' });
await page.waitForTimeout(6000);
const clip = { x: 520, y: 180, width: 400, height: 250 };
await page.screenshot({ path: `/private/tmp/claude-502/-Users-tarikmoody-Projects-domes/a4ea1970-af1c-4636-8df5-7906a2473228/scratchpad/look-${view}-base.png`, clip });
await page.evaluate((what) => {
  const D = window.__domes; const r = D.renderer;
  if (what === 'msaa0') { let rt; const o = r.setRenderTarget.bind(r); r.setRenderTarget = (t, ...a) => { if (t && t.depthTexture && !rt) { rt = t; t.samples = 0; t.dispose(); } return o(t, ...a); }; }
}, what);
await page.waitForTimeout(1500);
await page.screenshot({ path: `/private/tmp/claude-502/-Users-tarikmoody-Projects-domes/a4ea1970-af1c-4636-8df5-7906a2473228/scratchpad/look-${view}-${what}.png`, clip });
await browser.close();

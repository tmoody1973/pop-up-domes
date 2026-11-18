// Where does the MSAA cost go? msaa off vs depth-resolve off (the latter breaks post depth: cost probe only).
import { createRequire } from 'node:module';
const require = createRequire('/Users/tarikmoody/node_modules/');
const { chromium } = require('playwright-core');
const view = process.argv[2] || 'book';
const VIEWS = { start: { q: '' }, book: { q: 'dusk=1', zoom: true }, tropical: { q: 'dusk=1', x: 13.256, z: 13.285 } };
const V0 = VIEWS[view];
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--use-angle=metal', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage();
await page.goto('http://127.0.0.1:5360/?debug=1&hint=0&mute=1&quality=med&' + V0.q);
await page.waitForFunction(() => window.__domes && window.__interiors, null, { timeout: 90000 }); await page.waitForTimeout(1500);
await page.evaluate((V0) => { const D = window.__domes; if (V0.x) { D.traveller.teleport(V0.x, V0.z); D.follow.snap(D.traveller); } if (V0.zoom) D.follow.zoomBy(100); }, V0);
await page.waitForTimeout(5000);
const out = await page.evaluate(async () => {
  const D = window.__domes; const r = D.renderer; const wait = (ms) => new Promise((s) => setTimeout(s, ms));
  let rt = null; const o = r.setRenderTarget.bind(r); r.setRenderTarget = (t, ...a) => { if (t && t.depthTexture) rt = t; return o(t, ...a); };
  await wait(200);
  const med = (a) => { const s = a.slice().sort((x, y) => x - y); return +s[s.length >> 1].toFixed(2); };
  const run = () => new Promise((res) => { const f = []; let last = 0; const t0 = performance.now(); const tick = (t) => { if (last) f.push(t - last); last = t; if (t - t0 < 4000) requestAnimationFrame(tick); else res(med(f)); }; requestAnimationFrame(tick); });
  const s0 = rt.samples;
  const dm = D.scene.getObjectByName('domes');
  const V = {
    base: [() => {}, () => {}],
    msaa0: [() => { rt.samples = 0; rt.dispose(); }, () => { rt.samples = s0; rt.dispose(); }],
    domesHidden: [() => { dm.visible = false; }, () => { dm.visible = true; }],
    domesNoRecv: [() => { dm.receiveShadow = false; }, () => { dm.receiveShadow = true; }],
    domesNoCast: [() => { dm.castShadow = false; }, () => { dm.castShadow = true; }],
    domesTaps46: [() => { dm.material.defines = { ...dm.material.defines, PAPER_BLOCKER_TAPS: 4, PAPER_PCF_TAPS: 6 }; dm.material.needsUpdate = true; }, () => { dm.material.defines = { ...dm.material.defines, PAPER_BLOCKER_TAPS: 8, PAPER_PCF_TAPS: 12 }; dm.material.needsUpdate = true; }],
  };
  const res = { samples: s0, type: rt.texture.type, size: [rt.width, rt.height] };
  for (let rep = 0; rep < 3; rep++) for (const [k, [on, off]] of Object.entries(V)) { on(); await wait(1200); (res[k] ||= []).push(await run()); off(); await wait(800); }
  return res;
});
console.log(view, JSON.stringify(out));
await browser.close();

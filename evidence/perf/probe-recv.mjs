// Is the interior shadow cost on the caster side (shadow-map render) or the receiver side (PCSS in the paper shader)?
import { createRequire } from 'node:module';
const require = createRequire('/Users/tarikmoody/node_modules/');
const { chromium } = require('playwright-core');
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--use-angle=metal', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage();
await page.goto('http://127.0.0.1:5360/?debug=1&hint=0&mute=1&quality=med&dusk=1');
await page.waitForFunction(() => window.__domes && window.__interiors, null, { timeout: 90000 }); await page.waitForTimeout(1500);
await page.evaluate(() => { const D = window.__domes; D.traveller.teleport(13.256, 13.285); D.follow.snap(D.traveller); });
await page.waitForTimeout(5000);
const out = await page.evaluate(async () => {
  const D = window.__domes; const b = D.scene.getObjectByName('dome-interiors'); const r = D.renderer;
  const mats = () => { const s = new Set(); D.scene.traverse((o) => { const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach((x) => s.add(x)); }); return [...s]; };
  const taps = (a, c) => { for (const m of mats()) if (m.defines && m.defines.PAPER_BLOCKER_TAPS !== undefined) { m.defines = { ...m.defines, PAPER_BLOCKER_TAPS: a, PAPER_PCF_TAPS: c }; m.needsUpdate = true; } };
  const med = (a) => { const s = a.slice().sort((x, y) => x - y); return +s[s.length >> 1].toFixed(2); };
  const run = () => new Promise((res) => { const f = []; let last = 0; const t0 = performance.now(); const tick = (t) => { if (last) f.push(t - last); last = t; if (t - t0 < 3000) requestAnimationFrame(tick); else res(med(f)); }; requestAnimationFrame(tick); });
    const V = {
    base: [() => {}, () => {}],
    taps1: [() => taps(1, 1), () => taps(8, 12)],
    intNoRecv: [() => { b.receiveShadow = false; }, () => { b.receiveShadow = true; }],
    intNoCast: [() => { b.castShadow = false; }, () => { b.castShadow = true; }],
    customDepth: [() => { b.customDepthMaterial = P.depth; }, () => { b.customDepthMaterial = undefined; }],
    noA2C: [() => { b.material.alphaToCoverage = false; b.material.needsUpdate = true; }, () => { b.material.alphaToCoverage = true; b.material.needsUpdate = true; }],
    noA2Call: [() => { for (const m of mats()) if (m.alphaToCoverage) { m.alphaToCoverage = false; m.userData.a2c = 1; m.needsUpdate = true; } }, () => { for (const m of mats()) if (m.userData.a2c) { m.alphaToCoverage = true; m.needsUpdate = true; } }],
    noSort: [() => { b.sortObjects = false; }, () => { b.sortObjects = true; }],
    noCull: [() => { b.perObjectFrustumCulled = false; }, () => { b.perObjectFrustumCulled = true; }],
  };
  const wait = (ms) => new Promise((s) => setTimeout(s, ms));
  const res = {};
  const sm = r.shadowMap; const os = sm.render.bind(sm); let extra = 0; const tri = [];
  sm.render = (...a) => { const t0 = r.info.render.triangles; const c0 = r.info.render.calls; os(...a); tri.push([r.info.render.triangles - t0, r.info.render.calls - c0]); for (let i = 0; i < extra; i++) os(...a); };
  r.info.autoReset = false; r.info.reset(); await wait(300); res.shadowTrisCalls = tri[tri.length - 1]; b.castShadow = false; await wait(300); res.shadowTrisCallsNoInt = tri[tri.length - 1]; b.castShadow = true; r.info.autoReset = true;
  const key = D.scene.getObjectByName('key'); const setMap = (n) => { key.shadow.mapSize.set(n, n); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } };
  V.noCullNoSort = [() => { b.perObjectFrustumCulled = false; b.sortObjects = false; }, () => { b.perObjectFrustumCulled = true; b.sortObjects = true; }];
  const db = D.scene.getObjectByName('domes');
  V.bothBatchesStatic = [() => { for (const x of [b, db]) { x.userData.pc = [x.perObjectFrustumCulled, x.sortObjects]; x.perObjectFrustumCulled = false; x.sortObjects = false; } }, () => { for (const x of [b, db]) { [x.perObjectFrustumCulled, x.sortObjects] = x.userData.pc; } }];
  V.x3 = [() => { extra = 2; }, () => { extra = 0; }];
  V.x3noInt = [() => { extra = 2; b.castShadow = false; }, () => { extra = 0; b.castShadow = true; }];
  V.map512 = [() => setMap(512), () => setMap(2048)];
  V.x3map512 = [() => { extra = 2; setMap(512); }, () => { extra = 0; setMap(2048); }];
  const P = { depth: (() => { let dm = null; D.scene.traverse((o) => { if (!dm && o.customDepthMaterial && o.customDepthMaterial.isMeshDepthMaterial && !o.customDepthMaterial.map) dm = o.customDepthMaterial; }); return dm; })() };
  res.depthFound = !!P.depth; res.sort = b.sortObjects; res.a2c = b.material.alphaToCoverage;
  for (let rep = 0; rep < 3; rep++) for (const [k, [on, off]] of Object.entries(V).filter(([k]) => ['base', 'intNoCast', 'noCullNoSort', 'bothBatchesStatic'].includes(k))) { on(); await wait(1500); (res[k] ||= []).push(await run()); off(); await wait(1000); }
  return res;
});
console.log(JSON.stringify(out));
await browser.close();

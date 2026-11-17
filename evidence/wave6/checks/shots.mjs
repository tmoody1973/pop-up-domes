// wave6-Q (from wave5-L shots.mjs): framed captures + draw calls from the private vite-preview snapshot. Usage: node shots.mjs spec.json outdir
// spec: [{ name, query, w, h, x, z, pose:{distance,pitchDeg,yawDeg,fov,domeMix}|null, rise:null|0|1, cut:null|0|1, reach, wait }]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire('/Users/tarikmoody/node_modules/');
const { chromium } = require('playwright-core');
const [specFile, outDir] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specFile, 'utf8'));
const BASE = process.env.BASE || 'http://127.0.0.1:5310/';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const logs = [];
for (const s of spec) {
  const page = await browser.newPage({ viewport: { width: s.w || 1376, height: s.h || 768 }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(s.name + ' ' + m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => logs.push(s.name + ' pageerror: ' + e.message));
  await page.goto(BASE + '?debug=1&hint=0&mute=1&quality=med&' + (s.query || ''));
  await page.waitForFunction(() => window.__domes && window.__interiors, null, { timeout: 90000 });
  await page.addStyleTag({ content: '#hint{display:none!important}' });
  await page.waitForTimeout(3000);
  const setPose = () => page.evaluate((s) => {
    const D = window.__domes;
    D.domes.override.rise = s.rise ?? null; D.domes.override.cut = s.cut ?? null;
    if (s.reach) D.CONFIG.world.viewReachMax = s.reach;
    for (const id of s.flat || []) { // hold these domes folded flat (evidence only: wraps setTarget on this page)
      const d = D.domes.domes.find((k) => k.id === id);
      for (const f of d.folds) if (!f._held) { const o = f.setTarget.bind(f); f.setTarget = () => o(0); f._held = true; }
    }
    D.traveller.teleport(s.x, s.z);
    if (s.face !== undefined && D.traveller.setHeading) D.traveller.setHeading(s.face);
    if (s.pose) D.follow.setPose(s.pose);
    D.follow.snap(D.traveller);
  }, s);
  await setPose(); await page.waitForTimeout(1500); await setPose();
  await page.waitForTimeout(s.wait || 7000);
  const info = await page.evaluate(() => ({ hint: (() => { const h = document.getElementById('hint'); return h ? getComputedStyle(h).display + '/' + getComputedStyle(h).opacity : 'absent'; })(), mode: window.__interiors.daynight.mode,
    inside: window.__domes.domes.domes.filter((d) => d.inside).map((d) => d.id) }));
  const gl = await page.evaluate(() => new Promise((res) => { const R = window.__domes.renderer; R.info.autoReset = false; R.info.reset(); const c = []; const t = []; let n = 0; const tick = () => { if (n++) { c.push(R.info.render.calls); t.push(R.info.render.triangles); } R.info.reset(); if (c.length < 40) requestAnimationFrame(tick); else { R.info.autoReset = true; const m = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1]; res({ calls: m(c), tris: m(t) }); } }; requestAnimationFrame(tick); }));
  const cards = await page.evaluate(() => window.__interiors.debugProps().map((r) => r.id + ':' + r.cards).join(' '));
  await page.screenshot({ path: `${outDir}/${s.name}.jpg`, type: 'jpeg', quality: 80 });
  console.log(s.name, 'drawCalls', gl.calls, 'tris', gl.tris, 'cardPlanes', cards);
  console.log(s.name, JSON.stringify(info));
  await page.close();
}
console.log('console errors/warnings:', logs.length ? logs : 'none');
await browser.close();

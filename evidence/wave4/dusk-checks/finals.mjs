// wave4-K evidence: k1 dusk (concept-01 framing), k2 night, k3 day, k4 dusk inside the Desert Dome; the N-key cycle;
// the dynamic glow list (a material added after boot is picked up and follows the mode). Console errors collected.
// Usage: node finals.mjs   (dev server on http://127.0.0.1:5199)
import { createRequire } from 'node:module';
const require = createRequire('/Users/tarikmoody/node_modules/');
const { chromium } = require('playwright-core');
const OUT = '/Users/tarikmoody/Projects/domes/evidence/wave4/';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const logs = [];
const result = {};
async function open(query) {
  const page = await browser.newPage({ viewport: { width: 1512, height: 762 }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(query + ' ' + m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => logs.push(query + ' pageerror: ' + e.message));
  await page.goto('http://127.0.0.1:5199/?debug=1&hint=0&mute=1&quality=med&' + query);
  await page.waitForFunction(() => window.__domes && window.__interiors, null, { timeout: 90000 });
  await page.waitForTimeout(3000);
  return page;
}
const concept = (page) => page.evaluate(() => {
  const D = window.__domes; D.domes.override.rise = 1; D.CONFIG.world.viewReachMax = 14;
  D.traveller.teleport(3.0, 10.6); D.follow.setPose({ distance: 34, pitchDeg: 40, yawDeg: -45, fov: 38, domeMix: 0 }); D.follow.snap(D.traveller);
});
async function shot(query, file, pose) {
  const page = await open(query);
  await pose(page); await page.waitForTimeout(1500); await pose(page);
  await page.waitForTimeout(7000);
  await page.screenshot({ path: OUT + file, type: 'jpeg', quality: 80 });
  return page;
}

let page = await shot('dusk=1', 'k1-dusk-concept01-framing.jpg', concept);
// N cycle + dynamic glow list, on the dusk page
result.cycle = await page.evaluate(async () => {
  const dn = window.__interiors.daynight;
  const seen = [dn.mode];
  for (let i = 0; i < 3; i++) { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyN' })); seen.push(dn.mode); }
  const names = [...dn.glow].map((m) => m.name || m.type).filter((n, i, a) => a.indexOf(n) === i);
  return { seen, glowCount: dn.glow.size, glowNames: names};
});
// late-added prop: a mesh with an emissive material added now must join the list and take the current glow
result.lateProp = await page.evaluate(async () => {
  const D = window.__domes; const dn = window.__interiors.daynight;
  const src = [...dn.glow][0];
  const m = src.clone(); m.name = 'late-prop-glow'; m.emissiveIntensity = 1;
  let plain = null; D.scene.traverse((o) => { if (!plain && o.isMesh && !o.isBatchedMesh && !o.isInstancedMesh) plain = o; });
  const mesh = new plain.constructor(plain.geometry, m); // a plain THREE.Mesh
  mesh.visible = false; D.scene.add(mesh);
  await new Promise((r) => setTimeout(r, 1200));
  const inList = dn.glow.has(m); const g1 = m.emissiveIntensity;
  dn.set('night'); await new Promise((r) => setTimeout(r, 2500));
  const g2 = m.emissiveIntensity; D.scene.remove(mesh);
  return { inList, intensityAfterPickup: g1, configGlow: D.CONFIG.assets.glowIntensity, intensityAtNight: g2 };
});
await page.close();
await (await shot('night=1', 'k2-night.jpg', concept)).close();
await (await shot('', 'k3-day.jpg', concept)).close();
const inside = (page) => page.evaluate(async () => {
  const D = window.__domes; const dome = D.domes.domes.find((k) => k.id === 'desert');
  D.domes.override.rise = null; D.domes.override.cut = null;
  const W = await import('/src/world/interiors/paths.js');
  let best = [0, 0]; let bd = 1e9;
  for (const line of W.network('desert').polys) for (const [x, z] of line) { const q = Math.hypot(x, z - 0.6); if (q < bd) { bd = q; best = [x, z]; } }
  D.traveller.teleport(dome.x + best[0], dome.z + best[1]);
  D.follow.snap(D.traveller);
});
page = await shot('dusk=1', 'k4-dusk-inside-desert.jpg', inside);
result.k4 = await page.evaluate(() => ({ mode: window.__interiors.daynight.mode, inside: window.__domes.domes.domes.find((k) => k.id === 'desert').inside }));
await page.close();
console.log(JSON.stringify(result, null, 1));
console.log('console errors/warnings:', logs.length ? logs : 'none');
await browser.close();

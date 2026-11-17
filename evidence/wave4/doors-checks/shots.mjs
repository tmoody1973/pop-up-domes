// [wave4-J] evidence: headless system Chrome via playwright-core (pattern: wave3/interiors-checks/shots.mjs).
// j1 Show lobby door, j2 Desert-Tropical link (both doors), j3 Show Dome mid-rise with its doors. Also compares the
// doorway bearings drawn by domes/shell.js with the ones world/collide.js opened, and logs console errors.
import { createRequire } from 'node:module';
const require = createRequire('/Users/tarikmoody/node_modules/');
const { chromium } = require('playwright-core');
const OUT = '/Users/tarikmoody/Projects/domes/evidence/wave4/';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await page.goto('http://127.0.0.1:5199/?debug=1&hint=0&mute=1&quality=med');
await page.waitForFunction(() => window.__domes && window.__domes.domes, null, { timeout: 90000 });
await page.waitForTimeout(4000);

const pose = (x, z, cam) => page.evaluate(([x, z, cam]) => {
  const D = window.__domes; D.domes.override.rise = null; D.domes.override.cut = null;
  D.traveller.teleport(x, z); D.follow.setPose({ domeMix: 0, ...cam }); // no dome-proximity blend: the pose as given D.follow.snap(D.traveller);
}, [x, z, cam]);
const shot = (name) => page.screenshot({ path: OUT + name, type: 'jpeg', quality: 80 });

const bearings = await page.evaluate(async () => {
  const S = await import('/src/world/domes/shell.js');
  const col = window.__domes.world.collide.shapes.domes;
  return S.domeCentres().map((c) => ({ id: c.id,
    drawn: S.doorsOf(c).map((d) => +(d.bearing * 180 / Math.PI).toFixed(3)),
    collide: col.find((e) => e.id === c.id).doors.map((b) => +(b * 180 / Math.PI).toFixed(3)) }));
});
console.log('doorway bearings (deg), drawn vs collide:', JSON.stringify(bearings));
const doms = await page.evaluate(() => Object.fromEntries(window.__domes.domes.domes.map((d) => [d.id, [d.x, d.z]])));
const at = (id, deg, r) => { const [x, z] = doms[id]; const b = deg * Math.PI / 180; return [x + Math.cos(b) * r, z + Math.sin(b) * r]; };

// j1: Show lobby door (43 deg). The lobby box stands ~0.3 u off the ring there, so the door is framed from INSIDE the
// dome: traveller on the door line just inside, lens behind him toward the centre, cutaway sector held up (cut = 0;
// gore 2 is in the sector and would otherwise lie folded while he is inside).
{
  const b = 43.07; const [x, z] = at('show', b, 4.6); const yaw = Math.atan2(-Math.cos(b * Math.PI / 180), -Math.sin(b * Math.PI / 180)) * 180 / Math.PI;
  await pose(x, z, { distance: 3.4, pitchDeg: 24, yawDeg: yaw + 12, fov: 46 });
  await page.evaluate(() => { window.__domes.domes.override.cut = 0; window.__domes.domes.override.rise = 1; });
  await page.waitForTimeout(6000); await shot('j1-show-lobby-door.jpg');
}
// j2: Desert-Tropical link: traveller midway, lens east of the link
{
  const [dx, dz] = doms.desert; const [tx, tz] = doms.tropical;
  // the two doorways face each other across the gap: each is framed from the side of the other
  await pose(dx, (dz + tz) / 2, { distance: 7.5, pitchDeg: 26, yawDeg: 70, fov: 42, domeMix: 1 });
  await page.waitForTimeout(5000); await shot('j2-desert-tropical-link.jpg');
  await pose(dx, (dz + tz) / 2, { distance: 7.5, pitchDeg: 26, yawDeg: 110, fov: 42, domeMix: 1 });
  await page.waitForTimeout(4000); await shot('j2b-desert-tropical-link-other-door.jpg');
}
// j3: Show Dome folded, then rising: frame mid-rise (doorway gores 2 + 4 toward the lens)
{
  const [x, z] = at('show', 20, 8.5);
  await pose(x, z, { distance: 13, pitchDeg: 34, yawDeg: 70, fov: 40 });
  await page.evaluate(() => { window.__domes.domes.override.rise = 0; });
  await page.waitForTimeout(5000);
  await page.evaluate(() => { window.__domes.domes.override.rise = 1; });
  await page.waitForTimeout(650); await shot('j3-dome-folding-with-doors.jpg');
  await page.waitForTimeout(4000);
  await page.evaluate(() => { window.__domes.domes.override.rise = 0; });
  await page.waitForTimeout(5000); await shot('j3c-dome-folded-flat.jpg');
  await page.evaluate(() => { window.__domes.domes.override.rise = null; });
}
console.log('console errors/warnings:', logs.length ? logs : 'none');
await browser.close(); process.exit(0);

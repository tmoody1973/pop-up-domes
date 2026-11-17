// [wave4-J] collide.js clearance along each doorway walk line (dome risen), r = 4.6 .. 6.6 u: what the traveller's feet see.
import { createRequire } from 'node:module';
const require = createRequire('/Users/tarikmoody/node_modules/');
const { chromium } = require('playwright-core');
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:5199/?debug=1&hint=0&mute=1&quality=low');
await page.waitForFunction(() => window.__domes && window.__domes.domes, null, { timeout: 90000 });
await page.evaluate(() => { window.__domes.domes.override.rise = 1; });
await page.waitForTimeout(6000);
const out = await page.evaluate(async () => {
  const S = await import('/src/world/domes/shell.js');
  const W = window.__domes.world; const rows = [];
  for (const c of S.domeCentres()) for (const d of S.doorsOf(c)) {
    const row = { dome: c.id, deg: +(d.bearing * 180 / Math.PI).toFixed(1) };
    for (let r = 4.6; r <= 6.61; r += 0.25) row['r' + r.toFixed(2)] = +W.clearance(c.x + Math.cos(d.bearing) * r, c.z + Math.sin(d.bearing) * r).toFixed(2);
    rows.push(row);
    const off = { dome: c.id, deg: +(d.bearing * 180 / Math.PI + 30).toFixed(1) + ' (off-door)' }; const b = d.bearing + Math.PI / 6;
    for (let r = 4.6; r <= 6.61; r += 0.25) off['r' + r.toFixed(2)] = +W.clearance(c.x + Math.cos(b) * r, c.z + Math.sin(b) * r).toFixed(2);
    rows.push(off);
  }
  rows.push({ dome: 'fold progress', deg: window.__domes.domes.domes.map((d) => d.id + ' ' + d.folds[0].progress.toFixed(2)).join(' | ') });
  return rows;
});
console.table(out);
await page.evaluate(() => { window.__domes.domes.override.rise = null; });
await browser.close(); process.exit(0);

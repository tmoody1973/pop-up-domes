// [hint] issue #7 probe: after the opening tap / key closes the intro, is the gesture hint ever readable?
// Usage: BASE=http://127.0.0.1:5361 node evidence/hint/hint-probe.mjs   (vite dev server of app/)
// Per device (phone: touch + coarse pointer; desktop: mouse): load the page with the intro, check the hint text,
// tap / press a key once (the start the intro asks for), then sample #hint's computed opacity for 12 s.
// PASS = (a) the hint is hidden while the intro is up (it would share the screen and the starting tap would wipe it);
// (b) it is readable (class on, opacity >= 0.5) at 2 s and still at 6 s after the start tap
// (t=0 alone is not enough: before the fix the class was already off and only the CSS fade-out was running);
// (c) it has faded away by 12 s (it is a passing line, not a fixture).
// Also checks ?intro=0 (hint still shows) and ?hint=0 (hint removed).
import { createRequire } from 'node:module';
const require = createRequire('/Users/tarikmoody/node_modules/');
const { chromium, devices } = require('playwright-core');

const BASE = process.env.BASE || 'http://127.0.0.1:5361';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });

const DEVICES = {
  phone: devices['iPhone 13'], // 390x844 @3, isMobile, hasTouch -> (pointer: coarse)
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
};

async function open(device, query) {
  const ctx = await browser.newContext(DEVICES[device]);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?mute=1&quality=low${query}`);
  await page.waitForSelector('canvas', { timeout: 90000 });
  await page.waitForTimeout(2500);
  return { ctx, page };
}
const read = (page) => page.evaluate(() => {
  const h = document.getElementById('hint'); const i = document.getElementById('intro');
  return {
    hint: h ? { text: h.textContent, on: h.classList.contains('on'), opacity: +getComputedStyle(h).opacity } : null,
    introOn: i ? i.classList.contains('on') : null,
  };
});

async function start(page, device) {
  if (device === 'phone') await page.touchscreen.tap(195, 500);
  else await page.mouse.click(640, 500);
}

const results = [];
for (const device of ['phone', 'desktop']) {
  const { ctx, page } = await open(device, '');
  const before = await read(page);
  if (process.env.SHOTS) await page.screenshot({ path: new URL(`${device}-intro.jpg`, import.meta.url).pathname });
  await start(page, device);
  const t0 = Date.now(); const samples = []; let shot = false;
  while (Date.now() - t0 <= 12500) {
    const t = Date.now() - t0; samples.push({ t, ...(await read(page)) });
    if (process.env.SHOTS && !shot && t >= 2500) { shot = true; await page.screenshot({ path: new URL(`${device}-after-tap.jpg`, import.meta.url).pathname }); }
    await page.waitForTimeout(250);
  }
  const ok = (s) => s && !s.introOn && s.hint && s.hint.on && s.hint.opacity >= 0.5;
  const at = (ms) => samples.find((s) => s.t >= ms);
  const brief = samples.filter((s, i) => i % 4 === 0).map((s) => ({ t: s.t, introOn: s.introOn, hintOn: s.hint?.on, opacity: s.hint?.opacity }));
  results.push({ case: `${device}: hint hidden while the intro is up`, pass: !!before.introOn && !!before.hint && before.hint.opacity < 0.1, before });
  results.push({ case: `${device}: hint readable 2 s and 6 s after the start tap`, pass: ok(at(2000)) && ok(at(6000)), after: brief });
  results.push({ case: `${device}: hint faded away by 12 s`, pass: !!samples.at(-1).hint && samples.at(-1).hint.opacity < 0.1, last: samples.at(-1) });
  if (device === 'desktop') results.push({ case: 'desktop: hint keeps the keyboard wording', pass: /N dusk/.test(before.hint?.text || ''), text: before.hint?.text });
  if (device === 'phone') results.push({ case: 'phone: hint names the dusk gesture', pass: /2-finger tap: dusk/.test(before.hint?.text || ''), text: before.hint?.text });
  await ctx.close();
}
{ // ?intro=0: no overview, hint shows straight away
  const { ctx, page } = await open('phone', '&intro=0');
  await page.waitForFunction(() => +getComputedStyle(document.getElementById('hint')).opacity >= 0.5, null, { timeout: 8000 }).catch(() => {});
  const r = await read(page);
  results.push({ case: 'phone ?intro=0: hint on at load', pass: !!r.hint && r.hint.opacity >= 0.5, r });
  await ctx.close();
}
{ // ?hint=0: no on-screen text at all
  const { ctx, page } = await open('phone', '&hint=0');
  const r = await read(page);
  results.push({ case: 'phone ?hint=0: hint removed', pass: r.hint === null, r });
  await ctx.close();
}
await browser.close();

for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.case}\n      ${JSON.stringify(r, (k, v) => (k === 'case' || k === 'pass' ? undefined : v))}`);
const failed = results.filter((r) => !r.pass).length;
console.log(failed ? `\n${failed} FAILED` : '\nALL PASS');
process.exit(failed ? 1 : 0);

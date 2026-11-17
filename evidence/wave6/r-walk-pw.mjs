// wave3-G walk test: drives the traveller along scripted paths against the site collision (app/src/world/collide.js).
// Run: ego-browser nodejs < /Users/tarikmoody/Projects/domes/evidence/wave3/collide-checks/walk.mjs
// Needs the dev server (http://127.0.0.1:5199). Simulation is synchronous in the page (fixed dt 1/60, traveller.update
// with a scripted input + domes.update), so frame throttling does not change the result.
const URL = 'http://127.0.0.1:5321/?debug=1&hint=0';
const OUT = '/private/tmp/claude-502/-Users-tarikmoody-Projects-domes/a4ea1970-af1c-4636-8df5-7906a2473228/scratchpad';

import { createRequire } from 'node:module';
const require = createRequire('/Users/tarikmoody/node_modules/');
const { chromium } = require('playwright-core');
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1376, height: 768 } });
const task = { spaceId: 'playwright' };
// collect console errors / warnings from the first script on
await page.addInitScript({ content: `window.__errs = [];
  for (const k of ['error', 'warn']) { const o = console[k].bind(console); console[k] = (...a) => { window.__errs.push(k + ': ' + a.map(String).join(' ')); o(...a); }; }
  addEventListener('error', (e) => window.__errs.push('uncaught: ' + e.message));
  addEventListener('unhandledrejection', (e) => window.__errs.push('rejection: ' + (e.reason && e.reason.message || e.reason)));` });
await page.goto(URL, { timeout: 60000 });
await page.waitForFunction(() => window.__domes && window.__domes.world && window.__domes.world.collide && window.__domes.domes, undefined, { timeout: 60000 });

const result = await page.evaluate(() => {
  const D = window.__domes; const T = D.traveller; const W = D.world; const DM = D.domes;
  const C = W.collide; const sh = C.shapes; const R = D.CONFIG.player.radius;
  // stands in for the one main.js line: `if (domes) world.collide.setDomes(domes);`
  C.setDomes(DM);
  const dt = 1 / 60;
  const settleDomes = (rise) => { DM.override.rise = rise; DM.override.cut = 0; for (let i = 0; i < 360; i++) DM.update(dt, T.position); };
  const rows = [];
  const add = (test, name, pass, detail) => rows.push({ test, name, pass: pass ? 'PASS' : 'FAIL', detail });
  const f2 = (v) => Math.round(v * 100) / 100;

  /** Walk from (x,z) along (dx,dz) for secs; probe(p) -> per-frame record. Returns the samples. */
  function walk(x, z, dx, dz, secs) {
    const l = Math.hypot(dx, dz); dx /= l; dz /= l;
    T.teleport(x, z, dx, dz);
    const s = [];
    for (let i = 0; i < secs * 60; i++) { T.update(dt, { x: dx, z: dz }); DM.update(dt, T.position); s.push([T.position.x, T.position.z]); }
    return s;
  }
  const angDiff = (a, b) => { let d = a - b; d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI; return Math.abs(d); };
  const inDoor = (d, a) => d.doors.some((b) => angDiff(a, b) < sh.doorHalfAng);

  settleDomes(1);
  const domes = sh.domes;
  // (1) straight at each risen dome wall, from outside, on the bearing farthest from its doorways
  for (const d of domes) {
    const mx = d.doors.reduce((a, b) => a + Math.cos(b), 0); const mz = d.doors.reduce((a, b) => a + Math.sin(b), 0);
    const a = Math.atan2(-mz, -mx);
    const s = walk(d.x + Math.cos(a) * (sh.ringR + 2), d.z + Math.sin(a) * (sh.ringR + 2), -Math.cos(a), -Math.sin(a), 4);
    let minGap = Infinity; let badCross = 0; let prevOut = true;
    for (const [x, z] of s) {
      const r = Math.hypot(x - d.x, z - d.z); const out = r > sh.ringR;
      if (out !== prevOut && !inDoor(d, Math.atan2(z - d.z, x - d.x))) badCross++;
      prevOut = out; if (r > sh.ringR) minGap = Math.min(minGap, r - sh.rOut);
    }
    const [ex, ez] = s[s.length - 1]; const er = Math.hypot(ex - d.x, ez - d.z);
    add('1 wall stops', d.id + ' @' + Math.round(a * 180 / Math.PI) + 'deg', badCross === 0 && er > sh.ringR && minGap > R - 0.03,
      `closest centre-to-wall-face ${f2(minGap)} u (radius ${R}), stop r=${f2(er)} vs ring ${f2(sh.ringR)} (face ${f2(sh.rOut)})`);
  }
  // (2) enter each dome through each doorway
  for (const d of domes) for (const a of d.doors) {
    const s = walk(d.x + Math.cos(a) * (sh.ringR + 0.65), d.z + Math.sin(a) * (sh.ringR + 0.65), -Math.cos(a), -Math.sin(a), 2.5);
    const [ex, ez] = s[s.length - 1]; const er = Math.hypot(ex - d.x, ez - d.z);
    add('2 doorway enters', d.id + ' door @' + Math.round(a * 180 / Math.PI) + 'deg', er < sh.rIn - 0.3, `end r=${f2(er)} (inside < ${f2(sh.rIn)})`);
  }
  // (3) arcade: row coordinate s along u from arch 0, normal n = toward the plaza (away from the lobby)
  const A = sh.arcade; const [ux, uz] = A.u; const [ox, oz] = A.origin;
  let nx = -uz; let nz = ux; const [hx, hz] = sh.lobbyWalls.length ? [sh.lobbyWalls.reduce((t, w) => t + w.px, 0) / 4, sh.lobbyWalls.reduce((t, w) => t + w.pz, 0) / 4] : [0, 0];
  if ((hx - ox) * nx + (hz - oz) * nz > 0) { nx = -nx; nz = -nz; }
  const rowPt = (s, t) => [ox + ux * s + nx * t, oz + uz * s + nz * t];
  const rowS = (x, z) => (x - ox) * ux + (z - oz) * uz; const rowT = (x, z) => (x - ox) * nx + (z - oz) * nz;
  const openings = A.doors.map(([x, z]) => rowS(x, z));
  const inOpening = (s) => openings.some((c) => Math.abs(s - c) < A.opening / 2);
  function arcadeRun(name, s0, t0, dir, secs, wantThrough) {
    const [x, z] = rowPt(s0, t0); const smp = walk(x, z, -nx * dir, -nz * dir, secs);
    let bad = 0; let prevT = t0; let minT = Infinity;
    for (const [px, pz] of smp) { const t = rowT(px, pz); if (Math.sign(t) !== Math.sign(prevT) && !inOpening(rowS(px, pz))) bad++; prevT = t; minT = Math.min(minT, Math.abs(t)); }
    const [ex, ez] = smp[smp.length - 1]; const et = rowT(ex, ez);
    const through = et < -0.67 - 0.2; // past the stucco wall (8 ft = 0.67 u behind the arch row)
    add('3 arcade', name, bad === 0 && (wantThrough ? through : !through && Math.sign(et) === Math.sign(t0)),
      `end t=${f2(et)} u from the arch row (wall at -0.67), crossings outside openings: ${bad}, closest to row ${f2(minT)}`);
  }
  [3, 4, 5].forEach((i) => arcadeRun('through door arch ' + i, i * A.spacing, 1.5, 1, 3.5, true));
  arcadeRun('glazed arch 1 blocks', 1 * A.spacing, 1.5, 1, 2.5, false);
  arcadeRun('glazed arch 7 blocks', 7 * A.spacing, 1.5, 1, 2.5, false);
  // stucco wall from the lobby side, behind glazed arch 1: walking toward the plaza is stopped by the wall
  (() => {
    const s0 = 1 * A.spacing; const [x, z] = rowPt(s0, -1.6); const smp = walk(x, z, nx, nz, 2.0);
    const ts = smp.map(([px, pz]) => rowT(px, pz)); const maxT = Math.max(...ts);
    add('3 arcade', 'stucco wall blocks (behind arch 1)', maxT < -0.67, `closest t=${f2(maxT)} (wall at -0.67)`);
  })();
  // (4) pools
  sh.pools.forEach((p, i) => {
    const [ax, az] = sh.axis; const qx = -az; const qz = ax; // across the pool
    const side = (p.x - hx) * qx + (p.z - hz) * qz > 0 ? 1 : -1; // approach from the walk side
    const smp = walk(p.x - qx * side * (p.hw + 1.2), p.z - qz * side * (p.hw + 1.2), qx * side, qz * side, 3);
    let inside = 0; let minGap = Infinity;
    for (const [x, z] of smp) {
      const a = Math.abs((x - p.x) * ax + (z - p.z) * az) - p.hl; const b = Math.abs((x - p.x) * qx + (z - p.z) * qz) - p.hw;
      if (a < 0 && b < 0) inside++; else minGap = Math.min(minGap, Math.hypot(Math.max(a, 0), Math.max(b, 0)));
    }
    add('4 pool blocks', 'pool ' + i, inside === 0, `frames in water ${inside}, closest centre-to-water ${f2(minGap)} u`);
  });
  // (5) lobby
  const box = (x, z) => sh.lobbyWalls.every((w) => (x - w.px) * w.nx + (z - w.pz) * w.nz < 0);
  sh.lobbyWalls.forEach((w, k) => {
    const tx = -w.nz; const tz = w.nx;
    for (const [label, off, want] of [['door', 0, true], ['wall', 1.1, false]]) {
      const smp = walk(w.px + w.nx * 1.2 + tx * off, w.pz + w.nz * 1.2 + tz * off, -w.nx, -w.nz, label === 'door' ? 2.5 : 1.0);
      const inside = smp.filter(([x, z]) => box(x, z)).length; const [ex, ez] = smp[smp.length - 1];
      add('5 lobby', `wall ${k} ${label}${w.door ? '' : ' (no door)'}`, want ? box(ex, ez) && w.door : inside === 0,
        `frames inside ${inside}/${smp.length}, end ${box(ex, ez) ? 'inside' : 'outside'}`);
    }
  });
  // (6) folded-flat dome does not block (same path as (1) on the Show dome)
  settleDomes(0);
  (() => {
    const d = domes[0]; const prog = d.fold.progress;
    const mx = d.doors.reduce((a, b) => a + Math.cos(b), 0); const mz = d.doors.reduce((a, b) => a + Math.sin(b), 0);
    const a = Math.atan2(-mz, -mx);
    const smp = walk(d.x + Math.cos(a) * (sh.ringR + 2), d.z + Math.sin(a) * (sh.ringR + 2), -Math.cos(a), -Math.sin(a), 4);
    const [ex, ez] = smp[smp.length - 1]; const er = Math.hypot(ex - d.x, ez - d.z);
    add('6 folded dome passes', d.id + ' folded (progress ' + f2(prog) + ')', er < sh.rIn - 0.5, `end r=${f2(er)} (walked over the folded ring)`);
  })();
  DM.override.rise = null; DM.override.cut = null;
  return { rows, doors: domes.map((d) => ({ id: d.id, centre: [f2(d.x), f2(d.z)], doorsDeg: d.doors.map((a) => f2(a * 180 / Math.PI)) })),
    ring: { rIn: f2(sh.rIn), rOut: f2(sh.rOut), ringR: f2(sh.ringR), doorW: sh.domeDoorW, doorHalfDeg: f2(sh.doorHalfAng * 180 / Math.PI) },
    lobby: sh.lobbyWalls.map((w) => ({ at: [f2(w.px), f2(w.pz)], normal: [f2(w.nx), f2(w.nz)], halfLen: f2(w.hl), door: w.door })),
    arcade: { spacing: f2(A.spacing), archW: f2(A.W), opening: f2(A.opening), doors: A.doors.map(([x, z]) => [f2(x), f2(z)]) } };
});

const pad = (s, n) => String(s).padEnd(n);
console.log(pad('TEST', 22) + pad('CASE', 36) + pad('RESULT', 7) + 'DETAIL');
for (const r of result.rows) console.log(pad(r.test, 22) + pad(r.name, 36) + pad(r.pass, 7) + r.detail);
console.log(JSON.stringify({ ring: result.ring, doors: result.doors, lobby: result.lobby, arcade: result.arcade }, null, 1));

// screenshot: the traveller standing in the Show Dome's lobby-side doorway, dome risen by its own trigger
await page.evaluate(() => {
  const D = window.__domes; const sh = D.world.collide.shapes; const d = sh.domes[0]; const a = d.doors[0];
  D.traveller.teleport(d.x + Math.cos(a) * sh.ringR, d.z + Math.sin(a) * sh.ringR, -Math.cos(a), -Math.sin(a));
});
await page.waitForTimeout(4000);
await page.screenshot({ path: OUT + '/g1-doorway.png' });
const errs = await page.evaluate(() => window.__errs);
console.log({ consoleErrors: errs, fails: result.rows.filter((r) => r.pass !== 'PASS').length, taskSpaceId: task.spaceId });

await browser.close();

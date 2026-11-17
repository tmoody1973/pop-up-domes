// Fold feel: one gore's flaps (rise time, overshoot, flutter Hz, settle) and the whole-dome sweep, at 1/240 s.
const APP='/Users/tarikmoody/Projects/domes/app/';
const S = await import(APP+'src/world/domes/shell.js');
const { createFoldInstance } = await import(APP+'src/world/fold.js');
const geos = S.buildGeometries();
const d = S.buildDome(geos, 'feel');
const [ST, WB, SPAN] = (process.argv[2] || '').split(',').map(Number);
if (ST) d.main.traverse((o) => { if (o.userData.hinge && o.userData.part !== 'ring') { o.userData.stiffness = ST; o.userData.wobble = WB; } });
const span = SPAN || S.STAGGER_SPAN;
const fold = createFoldInstance(d.main, { tileId: 'feel', staggerSpan: span });
const GORE = 4;
const track = fold.flaps.filter((f) => f.node.userData.gore === GORE || f.node.userData.part === 'cap').filter((f) => f.node.userData.part !== 'ring' || f.node.userData.gore === GORE);
const st = new Map(track.map((f) => [f, { t0: null, rise: null, peak: 0, settle: null, cross: [], prev: 0 }]));
fold.setTarget(1);
const dt = 1 / 240; let t = 0; let domeSettled = null; let lastStart = 0;
while (t < 6) {
  fold.update(dt); t += dt;
  for (const f of fold.flaps) if (f.started && f.tgt === 1 && !f._s) { f._s = t; lastStart = Math.max(lastStart, t); }
  for (const f of track) {
    const s = st.get(f);
    if (s.t0 === null && f.started && f.tgt === 1) s.t0 = t;
    if (s.t0 === null) continue;
    if (s.rise === null && f.m >= 1) s.rise = t - s.t0;
    if (s.rise !== null) { s.peak = Math.max(s.peak, f.m - 1); const e = f.m - 1; if (s.prev > 0 && e <= 0 || s.prev < 0 && e >= 0) s.cross.push(t); s.prev = e; }
    if (s.settle === null && f.atRest && f.m === 1) s.settle = t - s.t0;
  }
  if (domeSettled === null && fold.settled) domeSettled = t;
}
const rows = track.map((f) => { const s = st.get(f); const c = s.cross; const hz = c.length > 2 ? (c.length - 1) / 2 / (c.at(-1) - c[0]) : null;
  return { flap: f.node.name, part: f.node.userData.part, size: +f.size.toFixed(2), tUp: +f.tUp.toFixed(3), rise_s: s.rise && +s.rise.toFixed(3), overshoot_pct: +(s.peak * 100).toFixed(1), flutter_hz: hz && +hz.toFixed(1), settle_s: s.settle && +s.settle.toFixed(3) }; });
console.log('FEEL', ST ? { stiffness: ST, wobble: WB } : S.FEEL, 'staggerSpan', span);
console.table(rows);
console.log({ lastFlapStarts_s: +lastStart.toFixed(3), wholeDomeSettled_s: domeSettled && +domeSettled.toFixed(3), flaps: fold.flaps.length });
// fold down
fold.setTarget(0); t = 0; let down = null; while (t < 8) { fold.update(dt); t += dt; if (down === null && fold.settled) down = t; }
console.log({ foldDownSettled_s: down && +down.toFixed(3) });

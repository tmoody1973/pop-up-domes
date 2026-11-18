// Frame-time profiler for the domes app (evidence only; injects hooks at runtime, no app code changes).
// Usage: node perf.mjs <mode> <view> <label> [quality]
//   mode:  ablate | passes | life | shot
//   view:  start | book | tropical
//   label: free text (before / after); results -> raw/<label>-<view>-<mode>[-<quality>].json
// Env: BASE (default http://127.0.0.1:5360/), HEADLESS=1, MEASURE_MS (5000), REPS (3), ONLY=a,b (ablation subset)
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { loadavg } from 'node:os';
const require = createRequire('/Users/tarikmoody/node_modules/');
const { chromium } = require('playwright-core');

const [mode = 'ablate', view = 'start', label = 'before', quality = 'med'] = process.argv.slice(2);
const BASE = process.env.BASE || 'http://127.0.0.1:5360/';
const MEASURE_MS = +(process.env.MEASURE_MS || 5000);
const REPS = +(process.env.REPS || 3);
const SETTLE_MS = 1500;
const OUT = new URL('./raw/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const VIEWS = {
  start: { query: '' },
  book: { query: 'dusk=1', zoomOut: true },
  tropical: { query: 'dusk=1', x: 13.256, z: 13.285 },
};
const V = VIEWS[view];
if (!V) throw new Error('unknown view ' + view);

const browser = await chromium.launch({ channel: 'chrome', headless: process.env.HEADLESS === '1',
  args: ['--use-angle=metal', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });

async function open(extra = '') {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(`${BASE}?debug=1&hint=0&mute=1&quality=${quality}&${V.query}&${extra}`);
  await page.waitForFunction(() => window.__domes && window.__domes.state, null, { timeout: 90000 });
  await page.addStyleTag({ content: '#hint{display:none!important}' });
  await page.waitForTimeout(1500);
  await page.evaluate((V) => {
    const D = window.__domes;
    if (V.x !== undefined) { D.traveller.teleport(V.x, V.z); D.follow.snap(D.traveller); }
    if (V.zoomOut) D.follow.zoomBy(100);
  }, V);
  if (process.env.GPU) await page.evaluate((g) => { window.__GPU_MODE = g; }, process.env.GPU);
  await page.evaluate(INSTALL);
  await page.waitForTimeout(4000); // warm-up
  return { ctx, page };
}

// ---- in-page instrumentation ------------------------------------------------------------------------
const INSTALL = () => {
  const D = window.__domes; const r = D.renderer; const gl = r.getContext();
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const P = { skip: new Set(), bypass: false, gpuMode: window.__GPU_MODE || 'off', frame: 0, gpu: [], kinds: {}, cpu: [], dropped: 0, ext: !!ext };
  window.__perf = P;
  const kindOf = new WeakMap();
  const classify = (m) => {
    const f = m.fragmentShader || '';
    if (f.includes('AO_TAPS')) return 'ao';
    if (f.includes('DOF_TAPS')) return 'gather';
    if (f.includes('uThreshold')) return 'bloomDown';
    if (f.includes('uDir')) return 'bloomBlur';
    if (f.includes('uFill')) return 'fill';
    if (f.includes('uAoOn')) return 'pre';
    if (f.includes('uSharpen')) { P.composite = m; return 'composite'; }
    if (f.includes('uHalfTexel')) return 'tile';
    return 'quad?';
  };
  // GPU timer queries: sequential (never nested); a frame's segments are summed once all are available
  const pending = []; let active = null; const frames = new Map();
  function begin(kind) { if (!ext || P.gpuMode === 'off') return; const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); active = { q, kind, frame: P.frame }; const f = frames.get(P.frame) || { sum: 0, left: 0, parts: {} }; f.left++; frames.set(P.frame, f); }
  function end() { if (!active) return; gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push(active); active = null; }
  function poll() {
    if (!ext) return;
    const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
    while (pending.length && gl.getQueryParameter(pending[0].q, gl.QUERY_RESULT_AVAILABLE)) {
      const p = pending.shift(); const ns = gl.getQueryParameter(p.q, gl.QUERY_RESULT); gl.deleteQuery(p.q);
      const f = frames.get(p.frame); if (!f) continue;
      if (disjoint) f.bad = true;
      f.sum += ns / 1e6; f.parts[p.kind] = (f.parts[p.kind] || 0) + ns / 1e6;
      if (--f.left === 0) { frames.delete(p.frame); if (f.bad) P.dropped++; else if (P.recording) { P.gpu.push(f.sum); for (const k in f.parts) (P.kinds[k] ||= []).push(f.parts[k]); } }
    }
  }
  const origRender = r.render.bind(r);
  r.render = function (scene, cam) {
    let kind;
    if (scene === D.scene) kind = cam === D.follow.camera ? 'scene' : 'water';
    else {
      const m = scene.children && scene.children.length === 1 && scene.children[0].material;
      if (m && m.isShaderMaterial) { kind = kindOf.get(m); if (!kind) { kind = classify(m); kindOf.set(m, kind); } } else kind = 'other';
    }
    if (kind !== 'scene' && kind !== 'water' && kind !== 'other' && (P.bypass || P.skip.has(kind))) return;
    if (P.bypass && kind === 'scene') r.setRenderTarget(null);
    if (P.gpuMode === 'passes') { end(); begin(kind); } else if (P.gpuMode === 'frame' && !active) begin('frame');
    origRender(scene, cam);
    if (r.getRenderTarget() === null) end(); // last draw of the frame (composite, or the bypassed scene)
  };
  const sm = r.shadowMap; const origShadow = sm.render.bind(sm);
  sm.render = function (...a) {
    if (P.gpuMode !== 'passes' || !active) return origShadow(...a);
    end(); begin('shadow'); origShadow(...a); end(); begin('scene');
  };
  // CPU time of the app's rAF tick (update + render submission)
  const origRaf = window.requestAnimationFrame.bind(window);
  P.raf = origRaf;
  r.info.autoReset = false;
  window.requestAnimationFrame = (cb) => origRaf((t) => { P.frame++; poll(); r.info.reset(); const t0 = performance.now(); cb(t); if (P.recording) { P.cpu.push(performance.now() - t0); P.calls.push(r.info.render.calls); P.tris.push(r.info.render.triangles); } });

  // ---- ablation toggles ---------------------------------------------------------------------------
  const mats = () => { const s = new Set(); D.scene.traverse((o) => { const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach((x) => s.add(x)); }); return [...s]; };
  const key = D.scene.getObjectByName('key');
  const hideSaved = new Map();
  const hide = (names, on) => {
    for (const n of names) {
      const o = D.scene.getObjectByName(n); if (!o) continue;
      o.traverse((c) => { if (on) { hideSaved.set(c, c.layers.mask); c.layers.mask = 1 << 30; } else if (hideSaved.has(c)) { c.layers.mask = hideSaved.get(c); hideSaved.delete(c); } });
    }
  };
  const define = (name, on) => { const m = P.composite; if (!m) return; const d = { ...m.defines }; if (on) delete d[name]; else d[name] = 1; m.defines = d; m.needsUpdate = true; };
  const sceneRT = () => P.composite && P.composite.uniforms.tScene.value; // texture; find its RT lazily
  let baseDpr = r.getPixelRatio();
  P.ablate = {
    dpr1: (on) => r.setPixelRatio(on ? 1 : baseDpr),
    dpr2: (on) => r.setPixelRatio(on ? 2 : baseDpr),
    post: (on) => { P.bypass = on; },
    dof: (on) => ['tile', 'gather', 'fill'].forEach((k) => (on ? P.skip.add(k) : P.skip.delete(k))),
    fill: (on) => (on ? P.skip.add('fill') : P.skip.delete('fill')),
    ao: (on) => { on ? P.skip.add('ao') : P.skip.delete('ao'); define('POST_AO', on); },
    bloom: (on) => { ['bloomDown', 'bloomBlur'].forEach((k) => (on ? P.skip.add(k) : P.skip.delete(k))); define('POST_BLOOM', on); },
    grain: (on) => define('POST_GRAIN', on),
    chroma: (on) => define('POST_CHROMA', on),
    sharpen: (on) => define('POST_SHARPEN', on),
    msaa: (on) => { const rt = P.sceneRT; if (!rt) { console.log('no sceneRT'); return; } rt.samples = on ? 0 : P.msaa0; rt.dispose(); },
    shadows: (on) => { key.castShadow = !on; },
    shadow1024: (on) => { const s = on ? 1024 : P.shadowSize0; key.shadow.mapSize.set(s, s); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } },
    pcss: (on) => { for (const m of mats()) if (m.defines && m.defines.PAPER_BLOCKER_TAPS !== undefined) { m.defines = { ...m.defines, PAPER_BLOCKER_TAPS: on ? 4 : P.taps0[0], PAPER_PCF_TAPS: on ? 6 : P.taps0[1] }; m.needsUpdate = true; } },
    interiors: (on) => hide(['dome-interiors'], on),
    domes: (on) => hide(['domes', 'dome-halos', 'dome-floors'], on),
    room: (on) => hide(['room'], on),
    life: (on) => hide(['life', 'life_animals'], on),
    site: (on) => hide(['site'], on),
    // second-round probes: where the rest of the post cost sits
    pre: (on) => (on ? P.skip.add('pre') : P.skip.delete('pre')),
    quads: (on) => ['ao', 'pre', 'tile', 'gather', 'fill', 'bloomDown', 'bloomBlur'].forEach((k) => (on ? P.skip.add(k) : P.skip.delete(k))),
    rim: (on) => { const m = P.composite; if (!m) return; P.compSrc0 ||= m.fragmentShader; m.fragmentShader = on ? P.compSrc0.replace(/float zfar2 = [\s\S]*?;\n/, 'float zfar2 = 0.0;\n').replace(/float rim = max\([^\n]*\n/, 'float rim = 0.0;\n') : P.compSrc0; m.needsUpdate = true; },
    shadowpass: (on) => { r.shadowMap.autoUpdate = !on; r.shadowMap.needsUpdate = true; }, // receivers still sample the (stale) map
    castInteriors: (on) => { const o = D.scene.getObjectByName('dome-interiors'); if (o) o.castShadow = !on; },
    castDomes: (on) => { const o = D.scene.getObjectByName('domes'); if (o) o.castShadow = !on; },
    castSite: (on) => { const o = D.scene.getObjectByName('site'); if (o) o.traverse((c) => { if (c.isMesh) { c.userData.cs0 ??= c.castShadow; c.castShadow = on ? false : c.userData.cs0; } }); },
    hdr8: (on) => { const rt = P.sceneRT; if (!rt) return; P.type0 ??= rt.texture.type; rt.texture.type = on ? 1009 : P.type0; rt.dispose(); },
  };
  P.shadowSize0 = key.shadow.mapSize.x;
  const pm = mats().find((m) => m.defines && m.defines.PAPER_BLOCKER_TAPS !== undefined);
  P.taps0 = pm ? [pm.defines.PAPER_BLOCKER_TAPS, pm.defines.PAPER_PCF_TAPS] : [8, 12];
  // the HDR scene target: the render target active during the main scene draw
  const origSRT = r.setRenderTarget.bind(r);
  r.setRenderTarget = function (rt, ...a) { if (rt && rt.depthTexture && !P.sceneRT) { P.sceneRT = rt; P.msaa0 = rt.samples; } return origSRT(rt, ...a); };

  P.measure = (ms) => new Promise((res) => {
    P.gpu = []; P.kinds = {}; P.cpu = []; P.calls = []; P.tris = []; P.dropped = 0; const d = []; let last = 0; P.recording = true;
    const t0 = performance.now();
    const f = (t) => { if (last) d.push(t - last); last = t; if (t - t0 < ms) P.raf(f); else { P.recording = false; setTimeout(() => res({ raf: d, gpu: P.gpu.slice(), cpu: P.cpu.slice(), kinds: P.kinds, dropped: P.dropped, dpr: r.getPixelRatio(), calls: P.calls.slice(), tris: P.tris.slice() }), 300); } };
    P.raf(f);
  });
};

const q = (a, p) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(3); };
const stats = (m) => ({ n: m.raf.length, med: q(m.raf, 0.5), p95: q(m.raf, 0.95), gpuMed: q(m.gpu, 0.5), gpuP95: q(m.gpu, 0.95), gpuN: m.gpu.length, cpuMed: q(m.cpu, 0.5), dpr: m.dpr, calls: q(m.calls, 0.5), tris: q(m.tris, 0.5), load1: +loadavg()[0].toFixed(2) });
async function measure(page) { const m = await page.evaluate((ms) => window.__perf.measure(ms), MEASURE_MS); return { ...stats(m), kinds: Object.fromEntries(Object.entries(m.kinds).map(([k, v]) => [k, q(v, 0.5)])) }; }

const result = { mode, view, label, quality, base: BASE, headless: process.env.HEADLESS === '1', measureMs: MEASURE_MS, reps: REPS, started: new Date().toISOString(), loadBefore: loadavg() };
const ABL = (process.env.ONLY || 'dpr1,dpr2,post,dof,fill,ao,bloom,grain,chroma,sharpen,msaa,shadows,shadow1024,pcss,interiors,domes,room,life,site').split(',');

if (mode === 'ablate' || mode === 'passes') {
  const { page } = await open();
  result.gpuTimer = await page.evaluate(() => window.__perf.ext);
  if (mode === 'passes') {
    await page.evaluate(() => { window.__perf.gpuMode = 'passes'; });
    await page.waitForTimeout(1000);
    result.passes = [];
    for (let i = 0; i < REPS; i++) result.passes.push(await measure(page));
  } else {
    result.ablations = {};
    for (const a of ABL) {
      const runs = { on: [], off: [] }; // on = feature present (baseline), off = ablated
      for (let i = 0; i < REPS; i++) {
        await page.evaluate((a) => window.__perf.ablate[a](false), a); await page.waitForTimeout(SETTLE_MS);
        runs.on.push(await measure(page));
        await page.evaluate((a) => window.__perf.ablate[a](true), a); await page.waitForTimeout(SETTLE_MS);
        runs.off.push(await measure(page));
      }
      await page.evaluate((a) => window.__perf.ablate[a](false), a);
      const avg = (k, s) => runs[s].reduce((x, r) => x + r[k], 0) / runs[s].length;
      const delta = (k) => +(avg(k, 'on') - avg(k, 'off')).toFixed(3);
      result.ablations[a] = { savedMed: delta('med'), savedP95: delta('p95'), savedGpu: delta('gpuMed'), savedCpu: delta('cpuMed'), runs };
      console.log(view, a, 'saved med', delta('med'), 'p95', delta('p95'), 'gpu', delta('gpuMed'), '| on med', avg('med', 'on').toFixed(2), 'off', avg('med', 'off').toFixed(2));
    }
  }
} else if (mode === 'life') {
  // URL-level ablation (?life=0&animals=0) needs a page load per run; interleave A B A B
  const runs = { on: [], off: [] };
  for (let i = 0; i < REPS; i++) {
    for (const s of ['on', 'off']) {
      const { ctx, page } = await open(s === 'off' ? 'life=0&animals=0' : '');
      runs[s].push(await measure(page)); await ctx.close();
    }
  }
  const avg = (k, s) => runs[s].reduce((x, r) => x + r[k], 0) / runs[s].length;
  result.life = { savedMed: +(avg('med', 'on') - avg('med', 'off')).toFixed(3), savedP95: +(avg('p95', 'on') - avg('p95', 'off')).toFixed(3), savedGpu: +(avg('gpuMed', 'on') - avg('gpuMed', 'off')).toFixed(3), savedCpu: +(avg('cpuMed', 'on') - avg('cpuMed', 'off')).toFixed(3), runs };
  console.log(view, 'life url', JSON.stringify({ ...result.life, runs: undefined }));
} else if (mode === 'base') {
  // plain baseline (no ablation): used for the before/after A/B, alternating builds between launches (ab.sh)
  const { page } = await open();
  result.baseline = await measure(page);
  console.log(view, label, quality, 'base', JSON.stringify({ ...result.baseline, kinds: undefined }));
} else if (mode === 'shot') {
  const { page } = await open();
  await page.waitForTimeout(2000);
  const path = new URL(`./shots/${label}-${view}-${quality}.jpg`, import.meta.url).pathname;
  mkdirSync(new URL('./shots/', import.meta.url).pathname, { recursive: true });
  await page.screenshot({ path, type: 'jpeg', quality: 80, scale: 'css' });
  result.shot = path;
  result.baseline = await measure(page);
  console.log(view, label, quality, 'shot', path, JSON.stringify({ ...result.baseline, kinds: undefined }));
}
result.loadAfter = loadavg();
const suffix = quality === 'med' ? '' : '-' + quality;
writeFileSync(`${OUT}${label}-${view}-${mode}${suffix}.json`, JSON.stringify(result, null, 1));
await browser.close();

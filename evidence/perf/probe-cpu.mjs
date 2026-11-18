// CPU-side timing (JS ms) of the shadow pass vs main scene draw vs whole tick, tropical interior, interiors casting on/off.
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
  const D = window.__domes; const r = D.renderer; const sm = r.shadowMap; const gl = r.getContext();
  const T = { shadow: [], scene: [], frame: [] };
  const os = sm.render.bind(sm); sm.render = (...a) => { const t = performance.now(); os(...a); T.shadow.push(performance.now() - t); };
  const or = r.render.bind(r); r.render = (s, c) => { const t = performance.now(); or(s, c); if (s === D.scene && c === D.follow.camera) T.scene.push(performance.now() - t); };
  const med = (a) => { const s = a.slice().sort((x, y) => x - y); return +s[s.length >> 1].toFixed(2); };
  const run = () => new Promise((res) => { T.shadow = []; T.scene = []; const f = []; let last = 0; const t0 = performance.now(); const tick = (t) => { if (last) f.push(t - last); last = t; if (t - t0 < 4000) requestAnimationFrame(tick); else res({ frame: med(f), shadowJs: med(T.shadow), sceneJsInclShadow: med(T.scene) }); }; requestAnimationFrame(tick); });
  const b = D.scene.getObjectByName('dome-interiors');
  const res = { inside: D.domes.domes.filter((d) => d.inside).map((d) => d.id), visible: b.visible, multiDraw: !!gl.getExtension('WEBGL_multi_draw'), instances: b.instanceCount ?? b._instanceInfo?.length, maxInstances: b.maxInstanceCount };
  res.on = await run(); b.castShadow = false; await new Promise((s) => setTimeout(s, 1500)); res.off = await run(); b.castShadow = true;
  // force a GPU sync after the shadow pass to see GPU time of the shadow pass alone
  const px = new Uint8Array(4);
  const fb = gl.createFramebuffer(); const tx = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tx); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); gl.bindTexture(gl.TEXTURE_2D, null);
  const sync = () => { const prev = gl.getParameter(gl.FRAMEBUFFER_BINDING); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tx, 0); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); gl.bindFramebuffer(gl.FRAMEBUFFER, prev); };
  sm.render = (...a) => { sync(); const t = performance.now(); os(...a); sync(); T.shadow.push(performance.now() - t); };
  r.render = (s, c) => { if (s === D.scene && c === D.follow.camera) { sync(); const t = performance.now(); or(s, c); sync(); T.scene.push(performance.now() - t); } else or(s, c); };
  await new Promise((s) => setTimeout(s, 1000)); res.syncedOn = await run();
  b.castShadow = false; await new Promise((s) => setTimeout(s, 1500)); res.syncedOff = await run(); b.castShadow = true;
  // segment probe: JS time from rAF start to the first renderer.render (= update()), synced GPU time of all renders, rest
  sm.render = os; 
  const seg = { upd: [], gpu: [], tick: [] }; let tStart = 0, firstR = 0, gpuAcc = 0;
  r.render = (s, c) => { if (!firstR) { firstR = performance.now(); sync(); } const t = performance.now(); or(s, c); sync(); gpuAcc += performance.now() - t; };
  const raf0 = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf0((ts) => { tStart = performance.now(); firstR = 0; gpuAcc = 0; cb(ts); const e = performance.now(); if (firstR) { seg.upd.push(firstR - tStart); seg.gpu.push(gpuAcc); seg.tick.push(e - tStart); } });
  const segRun = async () => { seg.upd = []; seg.gpu = []; seg.tick = []; await new Promise((s) => setTimeout(s, 3000)); return { upd: med(seg.upd), gpuRenders: med(seg.gpu), tick: med(seg.tick) }; };
  res.segOn = await segRun(); b.castShadow = false; await new Promise((s) => setTimeout(s, 1500)); res.segOff = await segRun(); b.castShadow = true;
  return res;
});
console.log(JSON.stringify(out));
await browser.close();

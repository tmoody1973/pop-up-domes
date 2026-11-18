// Probe: scene graph top level, GPU timer availability, uncapped rAF check.
import { createRequire } from 'node:module';
const require = createRequire('/Users/tarikmoody/node_modules/');
const { chromium } = require('playwright-core');
const BASE = process.env.BASE || 'http://127.0.0.1:5360/';
const browser = await chromium.launch({ channel: 'chrome', headless: process.env.HEADLESS === '1',
  args: ['--use-angle=metal', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(BASE + '?debug=1&hint=0&mute=1&quality=med');
await page.waitForFunction(() => window.__domes && window.__domes.state, null, { timeout: 90000 });
await page.waitForTimeout(4000);
const info = await page.evaluate(async () => {
  const D = window.__domes; const r = D.renderer;
  const gl = r.getContext();
  const kids = D.scene.children.map((o) => {
    let tris = 0, n = 0; o.traverse((c) => { if (c.isMesh) n++; });
    return { name: o.name, type: o.type, uuid: o.uuid.slice(0, 6), visible: o.visible, meshes: n, ud: Object.keys(o.userData || {}).join(',') };
  });
  const dpr = r.getPixelRatio();
  const t = []; await new Promise((res) => { let last = 0, k = 0; function f(n) { if (last) t.push(n - last); last = n; if (++k < 120) requestAnimationFrame(f); else res(); } requestAnimationFrame(f); });
  t.sort((a, b) => a - b);
  return { kids, dpr, canvas: [gl.drawingBufferWidth, gl.drawingBufferHeight], timer: !!gl.getExtension('EXT_disjoint_timer_query_webgl2'), renderer: gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL), medianMs: t[t.length >> 1], info: r.info.render, prog: r.info.programs.length };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();

// Builds the cost tables (markdown) from raw/*.json. Usage: node summarize.mjs [label=before] > table.md
import { readFileSync, existsSync } from 'node:fs';
const label = process.argv[2] || 'before';
const RAW = new URL('./raw/', import.meta.url).pathname;
const VIEWS = ['start', 'book', 'tropical'];
const load = (f) => (existsSync(RAW + f) ? JSON.parse(readFileSync(RAW + f, 'utf8')) : null);

const NAMES = {
  dpr2: 'pixel ratio 1.25 -> 2 (negative = costs more)', dpr1: 'pixel ratio 1.25 -> 1', post: 'whole post stack (scene straight to canvas, no MSAA/HDR)',
  dof: 'DOF (tile + gather + fill)', fill: 'DOF fill pass', ao: 'AO pass + composite AO taps', bloom: 'bloom passes + composite', grain: 'grain', chroma: 'chroma', sharpen: 'sharpen',
  msaa: 'MSAA 2x on the HDR scene target', hdr8: 'HDR half-float -> 8-bit scene target', shadows: 'key-light shadows (caster pass + PCSS receivers)',
  shadow1024: 'shadow map 2048 -> 1024', pcss: 'PCSS taps 8/12 -> 4/6', shadowpass: 'shadow-map re-render (stale map)', castInteriors: 'interior cards casting shadows',
  castDomes: 'dome shells casting shadows', castSite: 'site pieces casting shadows', interiors: 'interiors (hidden)', domes: 'dome shells (hidden)', room: 'room (hidden)',
  life: 'life + animals (hidden at runtime)', lifeUrl: 'life + animals (?life=0&animals=0, page reloads)', site: 'site pieces (hidden)', pre: 'post prefilter pass', quads: 'all half-res post passes',
  rim: 'composite cut-edge rim taps',
};
const rows = {};
const put = (k, v, a) => { (rows[k] ||= {})[v] = a; };
for (const v of VIEWS) {
  const a = load(`${label}-${v}-ablate.json`);
  const p2 = load(`${label}-probe2-${v}-ablate.json`);
  const l = load(`${label}-${v}-life.json`);
  // run 1's msaa / hdr8 rows are void: the dpr ablations before them rebuilt the post targets, so the toggle hit a stale target
  if (a) for (const [k, x] of Object.entries(a.ablations)) if (!(p2 && (k === 'msaa' || k === 'hdr8'))) put(k, v, x);
  if (p2) for (const [k, x] of Object.entries(p2.ablations)) put(k, v, x);
  if (l) put('lifeUrl', v, l.life);
}
const fmt = (x) => (x ? `${x.savedMed.toFixed(1)} / ${x.savedP95.toFixed(1)}` : '-');
const maxCost = (r) => Math.max(...VIEWS.map((v) => (r[v] ? r[v].savedMed : -99)));
const sorted = Object.entries(rows).filter(([k]) => k !== 'dpr2').sort((a, b) => maxCost(b[1]) - maxCost(a[1]));
if (rows.dpr2) sorted.push(['dpr2', rows.dpr2]);
const base = (v) => { const a = load(`${label}-${v}-ablate.json`); if (!a) return '-'; const on = Object.values(a.ablations).flatMap((x) => x.runs.on); const m = (k) => (on.reduce((s, r) => s + r[k], 0) / on.length).toFixed(1); return `${m('med')} / ${m('p95')}`; };
console.log(`| feature (ablation) | start: ms saved med / p95 | book @ dusk | inside Tropical @ dusk |`);
console.log(`|---|---|---|---|`);
console.log(`| *baseline frame (mean of all "on" runs), ms med / p95* | ${VIEWS.map(base).join(' | ')} |`);
for (const [k, r] of sorted) console.log(`| ${NAMES[k] || k} | ${VIEWS.map((v) => fmt(r[v])).join(' | ')} |`);

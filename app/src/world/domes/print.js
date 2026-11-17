// The printed art on the dome cards (browser only: 2-D canvas). One 1024 x 2048 sheet, laid out by shell.js LAYOUT:
//   - the unrolled gore (every tier card of every gore samples it): vellum panes (translucent alpha) under a white
//     die-cut lattice with a dark hub dot at every node. Bottom to top the lattice follows BUILD-NOTES §3:
//     hexagons with six spokes -> diamonds with a cross strut -> triangles -> ring beam -> closing bands;
//   - the base-ring card: fieldstone plinth, warm concrete saw-tooth wall, a louvre grille in every tooth (photo 01-ext/04);
//   - the apex cap: two concentric rings and radiating ribs round a dark fan housing (photos 02-int/18, 21);
//   - a white patch for the cut edges.
// A second sheet with the same lattice is the emissive map: panes white, everything else black, so the panes glow
// when the day/night glow intensity rises (daynight.js glow list).
import * as THREE from 'three';
import { LAYOUT, ROWS, RING, H, U_TOP } from './shell.js';

// [wave6-P] two looks, swapped by paint(mode):
//   day   = the real building (photos 01-ext/14, 02-int/18): near-clear glass, white struts, small hub dots, dark apex disc;
//   lantern (dusk / night) = concept frame 01: amber vellum lit from inside, so the lattice reads as a dark backlit
//   silhouette (taupe struts, brown hub dots) and the pale cap carries the lit halo.
const LOOKS = {
  day: {
    pane: 'rgba(206, 224, 240, 0.3)', // clear glass carrying the sky (domes.js SKY_GLOW); the planting shows through
    lattice: '#fbfaf6', hub: '#5b5a58', hubR: 0.02,
    apexDisc: '#4d4a41', apexRib: '#7a766b', // the dark round apex ring seen from below (photos 02-int/18, 21, 23)
    capBase: '#5d5a52', capRib: '#3a3833', capHub: '#24221f', capRim: '#d9d6cf',
  },
  lantern: {
    pane: 'rgba(240, 184, 96, 0.82)', // amber vellum, near opaque so it carries the inner glow
    lattice: '#7d6047', hub: '#3b2618', hubR: 0.034,
    capBase: '#ebe6da', capRib: '#b8b0a2', capHub: '#4e463f', capRim: '#ebe6da',
  },
};
const BASE_COL = { concrete: '#ebe4d4', louvre: '#6b5d4f' }; // precast concrete, read pale like the concept frames' white frieze
let COL = { ...BASE_COL, ...LOOKS.day };

const lerp = (a, b, t) => a + (b - a) * t;
function interp(key, val, out) {
  if (val <= ROWS[0][key]) return ROWS[0][out];
  for (let i = 1; i < ROWS.length; i++) {
    if (ROWS[i][key] >= val) { const a = ROWS[i - 1]; const b = ROWS[i]; return lerp(a[out], b[out], (val - a[key]) / Math.max(1e-9, b[key] - a[key])); }
  }
  return ROWS[ROWS.length - 1][out];
}
const sigmaAt = (u) => interp('u', u, 'sigma');
const hwAt = (sigma) => interp('sigma', sigma, 'hw');

/** Gore print space -> canvas px. xi = -1..1 across the gore (seam to seam), sigma = developed length from the base. */
function P(xi, sigma) {
  return [LAYOUT.gore.x + xi * hwAt(sigma) * LAYOUT.PX, LAYOUT.gore.y0 - sigma * LAYOUT.PX];
}

function goreOutline(ctx) {
  const top = sigmaAt(U_TOP);
  ctx.beginPath();
  for (let i = 0; i <= 64; i++) { const [x, y] = P(-1, (top * i) / 64); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  for (let i = 64; i >= 0; i--) { const [x, y] = P(1, (top * i) / 64); ctx.lineTo(x, y); }
  ctx.closePath();
}

/** Lattice geometry in (xi, sigma): segments + hub nodes, per BUILD-NOTES §3 zones. */
function lattice() {
  const seg = []; const hubs = []; const thick = [];
  const L = (a, b, list = seg) => list.push([a, b]);
  const s = sigmaAt;
  // zone 1, u 0 - 0.27: three rows of pointy-top hexagons, six spokes each (3 across a gore)
  {
    const s0 = s(0); const s1 = s(0.27); const b = (s1 - s0) / 5; const m = 3; const a = 1 / m;
    for (let r = 0; r < 3; r++) {
      const sc = s0 + b + r * 1.5 * b; const off = r % 2 ? a : 0;
      for (let j = -1; j <= m; j++) {
        const xc = -1 + a + 2 * a * j + off;
        const v = [[0, b], [a, b / 2], [a, -b / 2], [0, -b], [-a, -b / 2], [-a, b / 2]].map(([dx, dy]) => [xc + dx, sc + dy]);
        for (let k = 0; k < 6; k++) { L(v[k], v[(k + 1) % 6], thick); L([xc, sc], v[k]); hubs.push(v[k]); }
        hubs.push([xc, sc]);
      }
    }
  }
  // zone 2, u 0.27 - 0.55: four rows of diamonds with a horizontal cross strut (3 across)
  {
    const s0 = s(0.27); const s1 = s(0.55); const h = (s1 - s0) / 4; const m = 3; const a = 1 / m;
    for (let r = 0; r < 4; r++) {
      const sc = s0 + (r + 0.5) * h; const off = r % 2 ? a : 0;
      for (let j = -1; j <= m; j++) {
        const xc = -1 + a + 2 * a * j + off;
        const v = [[xc, sc + h / 2], [xc + a, sc], [xc, sc - h / 2], [xc - a, sc]];
        for (let k = 0; k < 4; k++) { L(v[k], v[(k + 1) % 4], thick); hubs.push(v[k]); }
        L(v[1], v[3]);
      }
    }
  }
  // zone 3, u 0.55 - 0.83: four rows of triangles (3 across)
  {
    const rows = [0.55, 0.62, 0.69, 0.76, 0.83].map(s); const m = 3;
    for (let r = 0; r < rows.length; r++) {
      const off = r % 2 ? 1 / m : 0;
      const nodes = []; for (let j = -1; j <= m + 1; j++) nodes.push([-1 + (2 * j) / m + off, rows[r]]);
      for (let j = 0; j + 1 < nodes.length; j++) L(nodes[j], nodes[j + 1], thick);
      hubs.push(...nodes);
      if (r + 1 < rows.length) {
        const offN = (r + 1) % 2 ? 1 / m : 0;
        for (const [x] of nodes) { L([x, rows[r]], [x + (offN - off) + 1 / m, rows[r + 1]]); L([x, rows[r]], [x + (offN - off) - 1 / m, rows[r + 1]]); }
      }
    }
  }
  // zone 4: ring beam (solid band, drawn in drawGore), then closing bands to the cap: centre rib + triangles
  {
    const rows = [0.86, 0.89, 0.94, U_TOP].map(s);
    for (let r = 0; r < rows.length; r++) {
      L([-1, rows[r]], [1, rows[r]], thick);
      hubs.push([-1, rows[r]], [0, rows[r]], [1, rows[r]]);
      if (r + 1 < rows.length) { L([0, rows[r]], [0, rows[r + 1]], thick); L([-1, rows[r]], [0, rows[r + 1]]); L([1, rows[r]], [0, rows[r + 1]]); }
    }
  }
  // seam nodes at every BUILD-NOTES ring
  for (const u of [0, 0.06, 0.13, 0.2, 0.27, 0.34, 0.41, 0.48, 0.55, 0.62, 0.69, 0.76, 0.83, 0.89, 0.94]) hubs.push([-1, s(u)], [1, s(u)]);
  return { seg, thick, hubs };
}

function drawGore(ctx, emissive) {
  const PX = LAYOUT.PX;
  const { seg, thick, hubs } = lattice();
  const line = (list, w) => {
    ctx.lineWidth = w; ctx.beginPath();
    for (const [[x0, s0], [x1, s1]] of list) { const a = P(x0, s0); const b = P(x1, s1); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
    ctx.stroke();
  };
  const fg = emissive ? '#000' : COL.lattice;
  // opaque lattice colour round the gore, so mip-maps bleed white (not clear) into the cut seams
  ctx.fillStyle = fg;
  ctx.fillRect(LAYOUT.gore.x - 260, 0, 520, LAYOUT.CH);
  ctx.save();
  goreOutline(ctx); ctx.clip();
  ctx.clearRect(LAYOUT.gore.x - 260, 0, 520, LAYOUT.CH);
  ctx.fillStyle = emissive ? '#fff' : COL.pane;
  ctx.fillRect(LAYOUT.gore.x - 260, 0, 520, LAYOUT.CH);
  ctx.strokeStyle = fg; ctx.lineCap = 'round';
  line(seg, 0.04 * PX);
  line(thick, 0.06 * PX);
  // ring beam (u 0.83 - 0.86) and the glass foot (u 0 - 0.012): solid
  ctx.fillStyle = fg;
  for (const [u0, u1] of [[0.83, 0.86], [0, 0.012]]) {
    const y0 = P(0, sigmaAt(u0))[1]; const y1 = P(0, sigmaAt(u1))[1];
    ctx.fillRect(LAYOUT.gore.x - 260, y1, 520, y0 - y1);
  }
  ctx.restore();
  // seam ribs: the gore edges are the strongest meridian lines (concept frame 01)
  ctx.save(); goreOutline(ctx); ctx.clip();
  ctx.strokeStyle = fg; ctx.lineWidth = 0.15 * PX; goreOutline(ctx); ctx.stroke();
  ctx.fillStyle = emissive ? '#000' : COL.hub;
  const r = COL.hubR * PX;
  for (const [x, s] of hubs) { const [px, py] = P(x, s); ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill(); }
  if (COL.apexDisc) { // day: everything above u 0.94 is the dark apex ring, a white rim round it, ribs to the cap
    const yA = P(0, sigmaAt(0.94))[1];
    ctx.fillStyle = emissive ? '#000' : COL.apexDisc; ctx.fillRect(LAYOUT.gore.x - 260, 0, 520, yA);
    if (!emissive) {
      ctx.strokeStyle = COL.apexRib; ctx.lineWidth = 0.035 * PX;
      ctx.beginPath(); ctx.moveTo(...P(0, sigmaAt(0.94))); ctx.lineTo(...P(0, sigmaAt(U_TOP))); ctx.stroke();
      ctx.fillStyle = COL.lattice; ctx.fillRect(LAYOUT.gore.x - 260, yA - 0.03 * PX, 520, 0.06 * PX);
    }
  }
  ctx.restore();
}

function drawRing(ctx, emissive) {
  const PX = LAYOUT.PX; const { x: RX, y: RY, w: W } = LAYOUT.ring;
  const peakH = RING.peak * H;
  const X = (x) => RX + (x + W / 2) * PX; const Y = (h) => RY + (peakH - h) * PX;
  if (emissive) { ctx.fillStyle = '#000'; ctx.fillRect(RX - 8, RY - 8, W * PX + 16, peakH * PX + 16); return; }
  ctx.fillStyle = COL.concrete; ctx.fillRect(RX - 8, RY - 8, W * PX + 16, peakH * PX + 16);
  // fieldstone plinth: rough stones in browns and greys (BUILD-NOTES §5)
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const ph = RING.plinth * H;
  ctx.fillStyle = '#7d7266'; ctx.fillRect(X(-W / 2) - 8, Y(ph), W * PX + 16, ph * PX + 8);
  const tones = ['#9a8a78', '#8c8379', '#a89580', '#7f7468', '#b2a28d', '#968b80'];
  for (let row = 0; row < 3; row++) {
    let x = -W / 2 - rnd() * 0.1;
    while (x < W / 2) {
      const w = 0.09 + rnd() * 0.1; const hh = ph / 3;
      ctx.fillStyle = tones[(rnd() * tones.length) | 0];
      ctx.beginPath(); ctx.ellipse(X(x + w / 2), Y(hh * (row + 0.5)), (w / 2) * PX * 0.92, (hh / 2) * PX * 0.85, 0, 0, Math.PI * 2); ctx.fill();
      x += w;
    }
  }
  ctx.fillStyle = '#efe9dc'; ctx.fillRect(X(-W / 2) - 8, Y(ph) - 0.012 * PX, W * PX + 16, 0.012 * PX); // coping
  // louvre grille in every tooth: an inset triangle with horizontal slats
  const T = RING.teeth; const vH = RING.valley * H;
  for (let k = 0; k < T; k++) {
    const xa = -W / 2 + (W * k) / T; const xb = xa + W / T; const xm = (xa + xb) / 2;
    const b0 = ph + 0.04; const apex = peakH - 0.13; const inset = 0.08;
    const tri = [[xa + inset + 0.04, b0], [xb - inset - 0.04, b0], [xm, apex]];
    ctx.fillStyle = COL.louvre; ctx.beginPath(); tri.forEach(([x, h], i) => (i ? ctx.lineTo(X(x), Y(h)) : ctx.moveTo(X(x), Y(h)))); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = '#cfc4b2'; ctx.lineWidth = 0.012 * PX;
    for (let h = b0 + 0.03; h < apex; h += 0.045) { ctx.beginPath(); ctx.moveTo(X(xa), Y(h)); ctx.lineTo(X(xb), Y(h)); ctx.stroke(); }
    ctx.restore();
    // a cream rim along the saw-tooth cut
    ctx.strokeStyle = '#fbf8f1'; ctx.lineWidth = 0.06 * PX;
    ctx.beginPath(); ctx.moveTo(X(xa), Y(vH)); ctx.lineTo(X(xm), Y(peakH)); ctx.lineTo(X(xb), Y(vH)); ctx.stroke();
  }
}

function drawCap(ctx, emissive) {
  const PX = LAYOUT.PX; const { x: CX, y: CY, r } = LAYOUT.cap; const R = r * PX;
  ctx.fillStyle = emissive ? '#000' : COL.capBase;
  ctx.fillRect(CX - R - 10, CY - R - 10, 2 * R + 20, 2 * R + 20);
  if (emissive) return;
  ctx.strokeStyle = COL.capRim; ctx.lineWidth = 0.05 * PX; ctx.beginPath(); ctx.arc(CX, CY, R * 0.97, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = COL.capRib; ctx.lineWidth = 0.018 * PX;
  for (const f of [0.92, 0.58]) { ctx.beginPath(); ctx.arc(CX, CY, R * f, 0, Math.PI * 2); ctx.stroke(); }
  ctx.lineWidth = 0.012 * PX;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(CX + Math.cos(a) * R * 0.3, CY + Math.sin(a) * R * 0.3); ctx.lineTo(CX + Math.cos(a) * R * 0.92, CY + Math.sin(a) * R * 0.92); ctx.stroke();
  }
  ctx.fillStyle = COL.capHub; ctx.beginPath(); ctx.arc(CX, CY, R * 0.28, 0, Math.PI * 2); ctx.fill();
}

function paintSheet(c, emissive) {
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = emissive ? '#000' : COL.lattice;
  ctx.fillRect(0, 0, c.width, c.height);
  drawGore(ctx, emissive);
  drawRing(ctx, emissive);
  drawCap(ctx, emissive);
  if (!emissive) { ctx.fillStyle = '#ffffff'; ctx.fillRect(LAYOUT.white.x - 12, LAYOUT.white.y - 12, 24, 24); }
}

function sheet(emissive) {
  const c = document.createElement('canvas');
  c.width = LAYOUT.CW; c.height = LAYOUT.CH;
  paintSheet(c, emissive);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = emissive ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.name = emissive ? 'dome_print_glow' : 'dome_print';
  return t;
}

/** { map, emissiveMap, paint(look) } CanvasTextures for the dome cards; paint('day'|'lantern') repaints both sheets. */
export function createPrint() {
  const map = sheet(false); const emissiveMap = sheet(true);
  return {
    map, emissiveMap,
    paint(look) {
      COL = { ...BASE_COL, ...LOOKS[look] };
      paintSheet(map.image, false); paintSheet(emissiveMap.image, true);
      map.needsUpdate = true; emissiveMap.needsUpdate = true;
    },
  };
}

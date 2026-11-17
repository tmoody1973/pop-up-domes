// The site print: walks, entry drive, plaza, the two reflecting pools, the lobby hub and the map labels, printed on
// the page as ONE world-space canvas laid just above it. World-space because the entrance axis runs at 45 degrees:
// path tiles would rasterise the diagonal walk as a staircase and could not hold a long diagonal pool.
// Canvas: north = top. Drawing is in FEET (+x east, +y north), mapped through the page rect (sitemap.js pageRect).
import * as THREE from 'three';
import { SITE, ftToWorld } from '../sitemap.js';

const INK = '#4b3527';
const COL = {
  walk: '#efd6ab', walkEdge: 'rgba(120, 88, 58, 0.45)',
  drive: '#d9c6a3', driveEdge: 'rgba(96, 72, 52, 0.55)',
  blvd: '#cdbb9b',
  coping: '#efe6d2', water: '#5fb7a6', waterDeep: '#2a8f87', ripple: 'rgba(236, 246, 236, 0.75)',
  hub: '#eadbbd',
  island: '#9fa06a',
};

// Feet along the entrance axis from the lobby centre (t) and across it (s, + = north-west). sitemap.js SITE.axis.
const [AX, AY] = SITE.axis;
const along = (t, s = 0) => [SITE.lobby.x + AX * t - AY * s, SITE.lobby.y + AY * t + AX * s];

/** Build the canvas + mesh. page = pageRect(TILE_SIZE) (world units); dip(x, z) = page height (gutter valley). */
export function buildSitePrint({ page, material, dip }) {
  const pxPerUnit = 64;
  const Wd = page.halfWidth * 2; const Dd = page.halfDepth * 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(Wd * pxPerUnit); canvas.height = Math.round(Dd * pxPerUnit);
  const g = canvas.getContext('2d');
  const x0 = page.x - page.halfWidth; const z0 = page.z - page.halfDepth;
  const [u1] = ftToWorld(1, 0); // world units per foot
  // feet -> canvas px: u = (xw - x0) * s, v = (zw - z0) * s with xw = x u1, zw = -y u1
  const toFt = () => g.setTransform(u1 * pxPerUnit, 0, 0, -u1 * pxPerUnit, -x0 * pxPerUnit, -z0 * pxPerUnit);
  toFt();
  g.globalAlpha = 0.92; // a little of the page's fibre and tone shows through the printed ground

  const stroke = (pts, width, color, cap = 'round') => {
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.lineWidth = width; g.strokeStyle = color; g.lineCap = cap; g.lineJoin = 'round'; g.stroke();
  };
  const band = (pts, width, fill, edge) => { stroke(pts, width + 1.6, edge); stroke(pts, width, fill); };
  const disc = (x, y, r, fill) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); };

  // S. Layton Blvd: the road along the west edge of the park, inside the page margin
  const west = (page.x - page.halfWidth) / u1 + 9; // ft, just inside the cream margin
  const blvdX = west + 8;
  const north = -(page.z - page.halfDepth) / u1; const south = -(page.z + page.halfDepth) / u1;
  band([[blvdX, north + 6], [blvdX, south - 6]], 16, COL.blvd, COL.driveEdge);
  g.setLineDash([6, 7]); stroke([[blvdX, north], [blvdX, south]], 0.7, 'rgba(250, 244, 228, 0.9)', 'butt'); g.setLineDash([]);

  // entry drive: Layton -> turnaround (plan 06, centre (-106, -195) ft) -> the plaza at the foot of the walk
  const turn = [-106, -195];
  const plaza = along(SITE.plazaT);
  const drive = [[blvdX, -248], turn, plaza];
  band(drive, 22, COL.drive, COL.driveEdge);
  disc(turn[0], turn[1], 40, COL.driveEdge); disc(turn[0], turn[1], 39, COL.drive);
  disc(turn[0], turn[1], 17, COL.driveEdge); disc(turn[0], turn[1], 16, COL.island);

  // link galleries and the lobby hub (plan 06): paved hub touching all three domes
  band([[70, 0], [99, 0]], 16, COL.walk, COL.walkEdge);
  band([[169, -70], [169, -88]], 16, COL.walk, COL.walkEdge);
  // [wave6-R] a paved neck from the hub to each dome's lobby door (the hub no longer touches all three)
  for (const d of SITE.domes) {
    const l = Math.hypot(d.x - SITE.lobby.x, d.y - SITE.lobby.y); const k = (l - d.r + 2) / l;
    band([[SITE.lobby.x, SITE.lobby.y], [SITE.lobby.x + (d.x - SITE.lobby.x) * k, SITE.lobby.y + (d.y - SITE.lobby.y) * k]], 16, COL.walk, COL.walkEdge);
  }
  disc(SITE.lobby.x, SITE.lobby.y, SITE.lobby.r + 1.2, COL.walkEdge);
  disc(SITE.lobby.x, SITE.lobby.y, SITE.lobby.r, COL.hub);
  // arcade forecourt (along the arch feet) and the walk down the axis to the plaza
  band([along(SITE.arcadeT - 2, -64), along(SITE.arcadeT - 2, 64)], 12, COL.walk, COL.walkEdge);
  band([along(40), along(SITE.plazaT)], 20, COL.walk, COL.walkEdge);
  // plaza with its ring of hour marks (photo 07 foreground)
  disc(plaza[0], plaza[1], 18.8, COL.walkEdge); disc(plaza[0], plaza[1], 18, COL.walk);
  g.beginPath(); g.arc(plaza[0], plaza[1], 12, 0, Math.PI * 2); g.lineWidth = 0.5; g.strokeStyle = 'rgba(96, 72, 52, 0.5)'; g.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    disc(plaza[0] + Math.cos(a) * 12, plaza[1] + Math.sin(a) * 12, 0.9, 'rgba(96, 72, 52, 0.55)');
  }

  // the two reflecting pools: long rectangles flanking the walk, coping, water, a few ripple dashes
  for (const pool of SITE.pools) drawPool(g, pool, toFt);

  g.globalAlpha = 1;
  // map labels (printed ink)
  const label = (text, x, y, size, rot = 0) => {
    const [wx, wz] = ftToWorld(x, y);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.translate((wx - x0) * pxPerUnit, (wz - z0) * pxPerUnit);
    g.rotate(rot);
    g.font = `600 ${Math.round(size * u1 * pxPerUnit)}px Georgia, 'Times New Roman', serif`;
    if ('letterSpacing' in g) g.letterSpacing = `${Math.round(size * 0.28 * u1 * pxPerUnit)}px`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = INK; g.globalAlpha = 0.82;
    g.fillText(text, 0, 0);
    g.globalAlpha = 1;
    if ('letterSpacing' in g) g.letterSpacing = '0px';
    toFt();
  };
  for (const l of SITE.labels) label(l.text, l.x, l.y, l.size, l.rot || 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const mat = material(tex);

  // a plane over the page, subdivided across the spine so it follows the gutter valley
  const geo = new THREE.PlaneGeometry(Wd, Dd, Math.round(Wd / 0.25), 1).rotateX(-Math.PI / 2);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) pos.setY(i, 0.0015 + dip(pos.getX(i) + page.x, pos.getZ(i) + page.z));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'site_print';
  mesh.position.set(page.x, 0, page.z);
  mesh.receiveShadow = true;
  mesh.renderOrder = 1;
  return mesh;
}

function drawPool(g, pool, toFt) {
  const ang = Math.atan2(SITE.axis[1], SITE.axis[0]);
  g.save();
  g.translate(pool.x, pool.y);
  g.rotate(ang);
  const L = pool.len; const w = pool.width;
  g.fillStyle = 'rgba(96, 72, 52, 0.5)'; g.fillRect(-L / 2 - 2.6, -w / 2 - 2.6, L + 5.2, w + 5.2);
  g.fillStyle = COL.coping; g.fillRect(-L / 2 - 2, -w / 2 - 2, L + 4, w + 4);
  const grad = g.createLinearGradient(0, -w / 2, 0, w / 2);
  grad.addColorStop(0, COL.waterDeep); grad.addColorStop(0.35, COL.water); grad.addColorStop(1, COL.water);
  g.fillStyle = grad; g.fillRect(-L / 2, -w / 2, L, w);
  // a few soft ripple rings (not dashes: dashes read as lane markings)
  g.strokeStyle = COL.ripple; g.lineWidth = 0.3;
  for (let i = 0; i < 4; i++) {
    const x = -L / 2 + 8 + ((i * 29) % (L - 16)); const y = -w / 2 + 4 + ((i * 3.7) % (w - 8));
    for (const r of [1.2, 2.4]) { g.beginPath(); g.ellipse(x, y, r * 1.6, r, 0, 0, Math.PI * 2); g.globalAlpha = r > 2 ? 0.35 : 0.6; g.stroke(); }
    g.globalAlpha = 1;
  }
  g.restore();
  toFt();
}

// Site set-pieces built in code (ARCHITECTURE.md §5.4 option A: standalone groups driven by fold.js, outside the tile
// streamer, because the arcade and lobby are wider than one tile and sit on the 45-degree entrance axis).
// Every piece is a Group of hinged flaps in its own frame; index.js places it, adds it to the scene and rises it.
// Dimensions: 1 world unit = 12 ft (sitemap.js SITE.ftPerTile 24 / TILE_SIZE 2). Art: vertex-colour print, drawn
// fresh from the photos (no photo pixels, PROMPT.md "Rights").
import * as THREE from 'three';
import { slab, rect, poly, cardMesh, flap, spriteCard } from './card.js';

// ---- palette (sRGB): pale exposed-aggregate concrete, glazing, warm stucco (photos 01-exterior/01, 05, 07, 09) ----
// [wave6-R] No flat dark fills: every piece is a printed illustration on white card. The glazing is pale sky-grey glass
// with reflection streaks, the lit interior (warm, plants) behind it; the lamp heads are green saucers with a lit rim.
const C = {
  card: '#fbf8f1', // the white cardstock the print is on: shows as a die-cut border round every piece
  concrete: '#e8dfcd',
  concreteShade: '#c9bca3', // inner reveal of the arch band
  speck: '#a99b86', // exposed aggregate
  glass: '#9fb4b8',
  glassSky: '#c9dadb', // reflection streaks
  glassHi: '#eef4f2',
  interior: '#efc27c', // warm light from inside (photo 11 at dusk)
  interiorDeep: '#d9a25f',
  plant: '#7f8f5c',
  mullion: '#d6cdbc',
  stucco: '#c7b8a1',
  plinth: '#8e8273',
  fascia: '#ddd3c1',
  lobbyGlass: '#9cb0b4',
  roof: '#cfc2aa',
  roofRim: '#b2a48c',
  stem: '#dfe3e2',
  stemShade: '#a9b0b0',
  leaf: '#4f8a70',
  leafTop: '#86bc9c',
  leafRim: '#2f5b4b',
  lamp: '#ffe2a0',
};

/** Deterministic 0..1 sequence (speckle placement). */
function seq(seed) { let x = seed >>> 0; return () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296); }

// ---- entrance arcade (photo 07: NINE parabolic arches; 01 shows the same nine from the drive) -------------------
export const ARCH_COUNT = 9;
// Proportions measured on photo 07 (2200 px wide): outer width ~100 px, rise ~280 px (h/w 2.8), centre spacing
// ~135 px (w/spacing 0.74), concrete band ~18 % of the width. Rise 2.3 units = 27.6 ft against the 7-ft traveller.
const ARCH = { H: 2.3, W: 2.3 / 2.8, spacing: (2.3 / 2.8) / 0.74, band: 0.17 };

/** Parabolic-family arch, foot to foot: y = H (1 - |2x / W|^P). P = 2 is the pure parabola; at h / w = 2.8 it read
 *  pointed (near gothic) on screen, while photos 07 / 09 show a blunt round crown on near-vertical legs, so P = 3
 *  (flatter crown, legs 3.5 deg off vertical). Left foot -> crown -> right foot. */
const ARCH_P = 3;
function archProfile(W, H, n = 48) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const x = -W / 2 + (W * i) / n;
    pts.push([x, H * (1 - Math.abs(2 * x / W) ** ARCH_P)]);
  }
  return pts;
}

function archCard(name, material, seed = 1) {
  const { H, W, band } = ARCH;
  const Wi = W - 2 * band * W; const Hi = H - band * W * 1.6;
  const outer = archProfile(W, H);
  const inner = archProfile(Wi, Hi);
  const halfAt = (y) => (Wi / 2) * Math.max(0, 1 - y / Hi) ** (1 / ARCH_P); // inner half width at height y
  // white card behind everything, die-cut a little proud of the concrete: the cardstock edge (no flat fills)
  const geos = [slab(poly(archProfile(W + 0.07, H + 0.045)), C.card, -0.022, 0.008)];
  // U-shaped frame: outer profile left -> right, then the inner profile back right -> left
  geos.push(slab(poly([...outer, ...inner.slice().reverse()]), C.concrete));
  // inner reveal: a shaded strip along the opening (the band is a deep U in section, photos 05 / 09)
  const reveal = archProfile(Wi + 0.07, Hi + 0.05);
  geos.push(slab(poly([...reveal, ...inner.slice().reverse()]), C.concreteShade, 0.0045, 0.008));
  // exposed aggregate: specks over the band
  const rnd = seq(seed * 7919);
  for (let i = 0; i < 26; i++) {
    const y = rnd() * H * 0.97; const side = rnd() < 0.5 ? -1 : 1;
    const xo = (W / 2) * Math.max(0, 1 - y / H) ** (1 / ARCH_P); const xi = y < Hi ? halfAt(y) + 0.04 : 0;
    if (xo - xi < 0.03) continue;
    const x = side * (xi + (xo - xi) * (0.15 + 0.7 * rnd())); const r = 0.006 + rnd() * 0.008;
    geos.push(slab(rect(r * 2, y - r, y + r, x), C.speck, 0.0045, 0.008));
  }
  // glazing (set back): pale glass, the lit interior low down, plants, then sky reflections streaked across the top
  geos.push(slab(poly(inner), C.glass, -0.014, 0.008));
  const yi = Hi * 0.5;
  geos.push(slab(rect(Wi * 0.78, 0, yi), C.interior, -0.0095, 0.002));
  geos.push(slab(rect(Wi * 0.78, 0, yi * 0.32), C.interiorDeep, -0.0085, 0.002));
  for (const [px, pr] of [[-Wi * 0.22, 0.09], [Wi * 0.18, 0.11], [0, 0.07]]) {
    const s = new THREE.Shape(); s.absarc(px, yi * 0.32, pr, 0, Math.PI, false); s.closePath();
    geos.push(slab(s, C.plant, -0.008, 0.002));
  }
  for (const [y0, y1, k, c] of [[Hi * 0.55, Hi * 0.75, 0.55, C.glassSky], [Hi * 0.62, Hi * 0.7, 0.25, C.glassHi], [Hi * 0.3, Hi * 0.42, 0.3, C.glassSky]]) {
    const a = halfAt(y1) * 0.9; const b = halfAt(y0) * 0.9;
    geos.push(slab(poly([[-b, y0], [-b + 0.08, y0], [Math.min(a, -b + 0.08 + k), y1], [Math.min(a, -b + k), y1]]), c, -0.0075, 0.002));
  }
  // mullions + the door transom (photo 07: two mullions per bay, doors under the middle three)
  for (const mx of [-Wi / 6, Wi / 6]) geos.push(slab(rect(0.022, 0, Hi * 0.86, mx), C.mullion, -0.004, 0.004));
  geos.push(slab(rect(Wi * 0.9, 0.62, 0.65), C.mullion, -0.004, 0.004));
  return cardMesh(name, geos, material);
}

/** The arcade: 9 arch cards in a row along local X, facing +Z (south-west), and the stucco front wall behind them. */
export function buildArcade(material) {
  const g = new THREE.Group();
  g.name = 'arcade';
  const { spacing, H } = ARCH;
  const rowLen = (ARCH_COUNT - 1) * spacing + ARCH.W;
  // front wall 8 ft behind the arch feet; folds south-west (away from the lobby) so its flat print stays clear of it
  const wall = cardMesh('arcade_wall', [
    slab(rect(rowLen + 0.3, 0, H * 0.68), C.stucco),
    slab(rect(rowLen + 0.3, 0, 0.16), C.plinth, 0.012, 0.008),
  ], material);
  g.add(flap('arcade_wall', wall, { z: -8 / 12, layer: 4, delay: 0, sign: 1, lean: 0.01, stiffness: 0.6 }));
  for (let i = 0; i < ARCH_COUNT; i++) {
    const k = i - (ARCH_COUNT - 1) / 2;
    const name = 'arch_' + i;
    // centre arch first, then outward in pairs; arches fold toward the lobby (print face up)
    g.add(flap(name, archCard(name, material, i + 1), {
      x: k * spacing, layer: 8, delay: 0.25 + 0.75 * (Math.abs(k) / 4), sign: -1, lean: 0.012 * Math.sign(k || 1), stiffness: 0.7,
    }));
  }
  g.userData.radius = rowLen / 2;
  return g;
}

// ---- lobby (photos 32, 33; plan 06 hub): low flat-roofed glass pavilion ------------------------------------------
// Pop-up box: four walls fold OUTWARD; each carries a roof triangle hinged on its top edge that folds down behind it.
// The roof triangle (depth W/2) must not reach below the page when it hangs, so W/2 <= H: 3.6 x 1.8 units = 43 ft
// square, 21.6 ft high (plan 06 hub is ~90 ft across: smaller, see LOG.md [wave2-E]).
const LOBBY = { W: 3.6, H: 1.8 };

// [wave4-I] One centred door pair per wall (collide.js LOBBY_DOOR_W 0.7 u: a door toward the arcade and each dome).
const DOOR = { W: 0.7, H: 0.62 };

function lobbyWall(name, material) {
  const { W, H } = LOBBY;
  const geos = [slab(rect(W, 0, H), C.fascia)];
  geos.push(slab(rect(W - 0.24, 0.1, H * 0.74), C.lobbyGlass, 0.011, 0.006));
  const n = 8;
  for (let i = 1; i < n; i++) geos.push(slab(rect(0.02, 0.1, H * 0.74, -W / 2 + 0.12 + ((W - 0.24) * i) / n), C.mullion, 0.015, 0.003));
  geos.push(slab(rect(DOOR.W + 0.06, 0, DOOR.H + 0.05), C.mullion, 0.016, 0.003)); // door frame
  geos.push(slab(rect(DOOR.W, 0, DOOR.H), C.glass, 0.019, 0.004)); // the door pair
  geos.push(slab(rect(0.02, 0, DOOR.H), C.mullion, 0.022, 0.003)); // meeting stiles
  return cardMesh(name, geos, material);
}

function lobbyRoof(name, material) {
  const { W } = LOBBY;
  const d = W / 2 - 0.02;
  return cardMesh(name, [
    slab(poly([[-W / 2, 0], [W / 2, 0], [0, d]]), C.roof),
    slab(rect(W - 0.06, 0, 0.07), C.roofRim, 0.009, 0.003), // parapet line along the eave
  ], material);
}

export function buildLobby(material) {
  const g = new THREE.Group();
  g.name = 'lobby';
  const { W, H } = LOBBY;
  for (let k = 0; k < 4; k++) {
    const yaw = (k * Math.PI) / 2;
    const name = 'lobby_wall_' + k;
    const delay = 0.1 * k;
    const w = flap(name, lobbyWall(name, material), {
      x: Math.sin(yaw) * (W / 2), z: Math.cos(yaw) * (W / 2), yaw, layer: k % 2, delay, sign: 1, stiffness: 0.7,
    });
    const roof = flap('lobby_roof_' + k, lobbyRoof('lobby_roof_' + k, material), { layer: k % 2, delay, sign: -1 });
    roof.position.set(0, H, -0.02);
    roof.rotation.set(-Math.PI / 2, 0, 0); // rest: horizontal, pointing into the box
    roof.userData.foldAngle = -Math.PI / 2; // folded: hangs down behind its wall
    w.add(roof);
    g.add(w);
  }
  g.userData.radius = W / 2;
  return g;
}

// ---- leaf-headed light poles (photos 03, 07): a tall curved silver stem with saucer lamp heads on arms ---------------
/** Side view of a saucer head centred at (cx, cy): flat lens, a low dome on top. */
function saucer(cx, cy, len, th = 1) {
  const s = new THREE.Shape();
  s.moveTo(cx - len / 2, cy);
  s.quadraticCurveTo(cx, cy + 0.075 * th, cx + len / 2, cy);
  s.quadraticCurveTo(cx, cy - 0.04 * th, cx - len / 2, cy);
  return s;
}
function dome(cx, cy, r) { const s = new THREE.Shape(); s.absarc(cx, cy, r, 0, Math.PI, false); s.closePath(); return s; }

/** Stem outline: thin taper, bowing out and curling over at the top (photo 07). Left edge up, right edge down. */
function stemPts(h, w0, w1) {
  const n = 14; const L = []; const R = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n; const y = h * t; const x = 0.16 * t ** 3; const w = w0 + (w1 - w0) * t;
    L.push([x - w, y]); R.push([x + w, y]);
  }
  return [...L, ...R.reverse()];
}

export function buildPole(name, material) {
  const h = 2.1;
  const geos = [slab(poly(stemPts(h + 0.02, 0.045, 0.03)), C.card, -0.006, 0.006)]; // white card behind the stem
  geos.push(slab(poly(stemPts(h, 0.025, 0.014)), C.stem));
  geos.push(slab(poly(stemPts(h * 0.98, 0.009, 0.005).map(([x, y]) => [x + 0.011, y])), C.stemShade, 0.0045, 0.008));
  // heads on short arms, alternating sides (photo 07: three per pole, the top one widest)
  for (const [y, dir, len] of [[h * 0.99, -1, 0.72], [h * 0.82, 1, 0.64], [h * 0.64, -1, 0.56]]) {
    const xs = 0.16 * (y / h) ** 3; const cx = xs + dir * (len / 2 + 0.02);
    geos.push(slab(rect(Math.abs(cx - xs) + 0.03, y + 0.012, y + 0.04, (cx + xs) / 2), C.card, -0.006, 0.006));
    geos.push(slab(rect(Math.abs(cx - xs), y + 0.018, y + 0.034, (cx + xs) / 2), C.stem));
    geos.push(slab(saucer(cx, y, len + 0.07, 1.7), C.card, -0.006, 0.006)); // die-cut white border
    geos.push(slab(dome(cx, y + 0.03, 0.075), C.card, -0.006, 0.006));
    geos.push(slab(saucer(cx, y, len), C.leaf));
    geos.push(slab(dome(cx, y + 0.028, 0.055), C.leaf));
    geos.push(slab(saucer(cx - len * 0.06, y + 0.008, len * 0.62, 0.5), C.leafTop, 0.0045, 0.008)); // lit crown
    geos.push(slab(saucer(cx, y - 0.006, len * 0.9, 0.3), C.leafRim, 0.0045, 0.008)); // rim line
    geos.push(slab(rect(len * 0.5, y - 0.03, y - 0.016, cx), C.lamp, 0.0045, 0.008)); // the lamp glowing underneath
  }
  const g = new THREE.Group();
  g.name = name;
  g.add(flap(name, cardMesh(name, geos, material), { layer: 2, sign: -1, lean: 0.015 }));
  g.userData.radius = 0.3;
  return g;
}

// ---- park trees (atlas tree cards, crossed): only where photos 01 / 09 show trees on the lawn ------------------------
export function buildTree(name, sprite, atlasSize, material, height = 2.6) {
  const g = new THREE.Group();
  g.name = name;
  g.add(flap(name + '_a', spriteCard(name + '_a', sprite, atlasSize, height, material), { layer: 2, sign: -1, lean: 0.02 }));
  g.add(flap(name + '_b', spriteCard(name + '_b', sprite, atlasSize, height, material), { layer: 3, yaw: Math.PI / 2, sign: 1, lean: -0.015, delay: 0.3 }));
  g.userData.radius = 0.6;
  return g;
}

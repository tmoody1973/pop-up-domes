// Site set-pieces built in code (ARCHITECTURE.md §5.4 option A: standalone groups driven by fold.js, outside the tile
// streamer, because the arcade and lobby are wider than one tile and sit on the 45-degree entrance axis).
// Every piece is a Group of hinged flaps in its own frame; index.js places it, adds it to the scene and rises it.
// Dimensions: 1 world unit = 12 ft (sitemap.js SITE.ftPerTile 24 / TILE_SIZE 2). Art: vertex-colour print, drawn
// fresh from the photos (no photo pixels, PROMPT.md "Rights").
import * as THREE from 'three';
import { slab, rect, poly, cardMesh, flap, spriteCard } from './card.js';

// ---- palette (sRGB): pale exposed-aggregate concrete, dark glazing, warm stucco (photos 01-exterior/01, 07, 09) ----
const C = {
  concrete: '#e8dfcd',
  glass: '#3f4c52',
  mullion: '#d6cdbc',
  stucco: '#c7b8a1',
  plinth: '#8e8273',
  fascia: '#ddd3c1',
  lobbyGlass: '#4a5960',
  roof: '#cfc2aa',
  roofRim: '#b2a48c',
  stem: '#cfcfc6',
  leaf: '#2f5b4b',
};

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

function archCard(name, material) {
  const { H, W, band } = ARCH;
  const Wi = W - 2 * band * W; const Hi = H - band * W * 1.6;
  const outer = archProfile(W, H);
  const inner = archProfile(Wi, Hi);
  // U-shaped frame: outer profile left -> right, then the inner profile back right -> left
  const frame = poly([...outer, ...inner.slice().reverse()]);
  const geos = [slab(frame, C.concrete)];
  geos.push(slab(poly(inner), C.glass, -0.014, 0.008)); // glazing set back inside the frame
  // mullions + the door transom (photo 07: two mullions per bay, doors under the middle three)
  for (const mx of [-Wi / 6, Wi / 6]) geos.push(slab(rect(0.022, 0, Hi * 0.86, mx), C.mullion, -0.008, 0.004));
  geos.push(slab(rect(Wi * 0.9, 0.62, 0.65), C.mullion, -0.008, 0.004));
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
    g.add(flap(name, archCard(name, material), {
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

// ---- leaf-headed light poles (photos 03, 07): a tall curved stem with flat leaf-shaped lamp heads ----------------
function leafShape(cx, cy, len, w, dir) {
  const s = new THREE.Shape();
  s.moveTo(cx, cy);
  s.quadraticCurveTo(cx + (dir * len) / 2, cy + w, cx + dir * len, cy + w * 0.15);
  s.quadraticCurveTo(cx + (dir * len) / 2, cy - w * 0.6, cx, cy);
  return s;
}

export function buildPole(name, material) {
  const h = 2.1;
  const geos = [slab(poly([[-0.025, 0], [0.025, 0], [0.03, h * 0.7], [0.11, h], [0.08, h], [-0.005, h * 0.7]]), C.stem)];
  // saucer heads (photo 07): broad, thin, dark green, on short arms, alternating sides
  for (const [y, dir, len] of [[h * 0.99, -1, 0.75], [h * 0.82, 1, 0.68], [h * 0.64, -1, 0.58]]) {
    geos.push(slab(rect(len * 0.5, y - 0.015, y + 0.015, dir * len * 0.25), C.stem, 0, 0.012));
    geos.push(slab(leafShape(dir * len * 0.1, y, len, 0.13, dir), C.leaf, 0.004));
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

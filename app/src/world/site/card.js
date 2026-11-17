// Code-built cardstock for the site set-pieces (docs/ARCHITECTURE.md §4.B): 0.016-thick slabs in local XY, +Z = printed
// front, origin on the bottom (hinge) edge at mid-width. Colour comes from vertex colours (the paper material always
// multiplies them in); faces with atlas art carry uv1 inside the sprite rect, every other face uv1 = -1 (no art).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG, FLAP_LAYER_GAP } from '../../core/config.js';

const T = CONFIG.assets.cardThickness; // 0.016
const EDGE = new THREE.Color('#efe4cf'); // cream cut edge

/** Linear-space colour from an sRGB hex (vertex colours are linear). */
const lin = (hex) => new THREE.Color(hex);

/**
 * One flat slab from a THREE.Shape, front/back faces in `color`, cut edges cream. z = centre-plane offset (glue a
 * decoration layer proud of / behind the card with z = ±0.004 .. ±0.02).
 */
export function slab(shape, color, z = 0, depth = T) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 6 });
  geo.translate(0, 0, z - depth / 2);
  const pos = geo.getAttribute('position');
  const nrm = geo.getAttribute('normal');
  const col = new Float32Array(pos.count * 3);
  const uv1 = new Float32Array(pos.count * 2).fill(-1);
  const c = lin(color);
  for (let i = 0; i < pos.count; i++) {
    const k = Math.abs(nrm.getZ(i)) > 0.9 ? c : EDGE;
    col[i * 3] = k.r; col[i * 3 + 1] = k.g; col[i * 3 + 2] = k.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
  return geo;
}

/** Rectangle shape, x centred, y from y0 to y1. */
export function rect(w, y0, y1, x = 0) {
  const s = new THREE.Shape();
  s.moveTo(x - w / 2, y0); s.lineTo(x + w / 2, y0); s.lineTo(x + w / 2, y1); s.lineTo(x - w / 2, y1); s.closePath();
  return s;
}

/** Shape from [[x, y], ...]. */
export function poly(pts) {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}

/** Merge slabs into one mesh (one draw call) on the given material. */
export function cardMesh(name, geos, material) {
  const geo = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = name + '_mesh';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * A hinged flap Group (fold.js reads userData). Rest = upright with a small hand-made lean, folded = exactly flat
 * (foldAngle = sign * 90 deg - lean). sign -1 = top swings to local -Z, the printed +Z face ends face-up.
 */
export function flap(name, mesh, { x = 0, z = 0, yaw = 0, layer = 0, delay = 0, sign = -1, lean = 0, ...extra } = {}) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, FLAP_LAYER_GAP * (layer + 1), z);
  g.rotation.set(lean, yaw, 0, 'YXZ');
  g.userData = { hinge: true, foldAngle: sign * Math.PI / 2 - lean, delay, layer, sway: 0, ...extra };
  if (mesh) g.add(mesh);
  return g;
}

/**
 * A card cut to an atlas sprite outline, printed on both faces (ARCHITECTURE.md §4.B makeCard). sprite = atlas.json
 * sprites[key]; atlasSize = atlas.json size.
 */
export function spriteCard(name, sprite, atlasSize, height, material) {
  const W = height * sprite.aspect; const H = height;
  const shape = poly(sprite.outline.map(([u, v]) => [(u - 0.5) * W, v * H]));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false, curveSegments: 1 });
  geo.translate(0, 0, -T / 2);
  const pos = geo.getAttribute('position'); const nrm = geo.getAttribute('normal');
  const uv1 = new Float32Array(pos.count * 2); const col = new Float32Array(pos.count * 3);
  const [rx, ry, rw, rh] = sprite.rect; const [AW, AH] = atlasSize;
  for (let i = 0; i < pos.count; i++) {
    const cap = Math.abs(nrm.getZ(i)) > 0.9;
    const xn = pos.getX(i) / W + 0.5; const yn = pos.getY(i) / H;
    uv1[i * 2] = cap ? (rx + xn * rw) / AW : -1;
    uv1[i * 2 + 1] = cap ? (ry + (1 - yn) * rh) / AH : -1;
    const c = cap ? 1 : 0.18; // white art face, dark cut edge (papertrails tree cards)
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = c;
  }
  geo.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = name + '_mesh';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

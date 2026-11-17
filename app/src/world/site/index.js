// Domes site props (wave2-E): the world-space site print and the set-pieces that stand on it (entrance arcade, lobby,
// leaf poles, park trees). Each set-piece is ONE fold instance that rises whole when the traveller comes within
// RISE of its footprint and folds flat beyond FOLD (ARCHITECTURE.md §5.4 option A; same idea as the dome rise).
// Folded pieces stay drawn, lying flat on the page: there is no baked twin for a set-piece.
// Hooked from world.js: createSiteProps(...) at creation, site.update(dt, travellerPos) every frame.
import * as THREE from 'three';
import { CONFIG, TILE_SIZE } from '../../core/config.js';
import { createFoldInstance } from '../fold.js';
import { SITE, ftToWorld } from '../sitemap.js';
import { buildSitePrint } from './print.js';
import { buildArcade, buildLobby, buildPole, buildTree, ARCH_COUNT } from './pieces.js';

const RISE = 6; // world units from a piece's footprint (3 tiles)
const FOLD = 8.5; // hysteresis
const [AX, AY] = SITE.axis;
const along = (t, s = 0) => ftToWorld(SITE.lobby.x + AX * t - AY * s, SITE.lobby.y + AY * t + AX * s);
const AXIS_YAW = Math.atan2(AX, -AY); // local +Z -> south-west (world dir (AX, -AY) in x / z)

// [wave4-I] Sight-line fade (the make-room idea of world.js, for set-pieces; collision untouched): a risen piece whose
// rest-pose box (in its own frame) cuts the line from the traveller's feet or head to the lens dithers out. Each fading
// piece gets its own paper instance (same look, same program) with one extra uniform. The arcade is left out: it is an
// open colonnade, the hero cut-out (materials.js) already sees him between the arches.
const FADE_IN = 0.15; // box margin (world units) that starts a fade
const FADE_OUT = 0.45; // larger margin that must clear before the piece comes back (hysteresis)
const FADE_TIME = 0.3; // seconds for a full fade
const SIGHT_H = [0.08, CONFIG.TRAVELLER_HEIGHT]; // feet and head
function addFade(m, u) {
  const prev = m.onBeforeCompile; const prevKey = m.customProgramCacheKey;
  m.onBeforeCompile = (shader, renderer) => {
    if (prev) prev.call(m, shader, renderer);
    shader.uniforms.uSiteFade = u;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSiteFade;\nfloat siteBayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }')
      .replace('void main() {', 'void main() {\n  if (uSiteFade > 0.0 && siteBayer2(0.5 * gl_FragCoord.xy) * 0.25 + siteBayer2(gl_FragCoord.xy) + 0.03 < uSiteFade) discard;');
  };
  m.customProgramCacheKey = () => (prevKey ? prevKey.call(m) : '') + '|site-fade';
  return m;
}
const _o = new THREE.Vector3(); const _d = new THREE.Vector3(); const _hit = new THREE.Vector3(); const _ray = new THREE.Ray();
/** Does the segment traveller (feet / head) -> camera cross the piece's local box grown by `margin`? */
function blocksSight(p, trav, cam, margin) {
  const box = margin === FADE_IN ? p.boxIn : p.boxOut;
  for (const h of SIGHT_H) {
    _o.set(trav.x, trav.y + h, trav.z);
    _d.copy(cam.position).sub(_o);
    const len = _d.length();
    _ray.set(_o, _d.divideScalar(len || 1)).applyMatrix4(p.inv);
    if (_ray.intersectBox(box, _hit) && _hit.distanceTo(_ray.origin) < len) return true;
  }
  return false;
}

export function createSiteProps({ scene, materials, assets, wfc, dip }) {
  const root = new THREE.Group();
  root.name = 'site';
  scene.add(root);
  const paper = materials.paper({ color: '#ffffff', side: THREE.DoubleSide, variant: 'site' });
  const page = wfc.page(TILE_SIZE);
  // ponytail: stock Lambert, not paper(): the paper shader writes opaque alpha, so a transparent print went black.
  // The page under it carries the fibre; the print is ink on top of it.
  const printMat = (map) => new THREE.MeshLambertMaterial({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const print = buildSitePrint({ page, material: printMat, dip });
  root.add(print);

  const pieces = [];
  let camera = null;
  // own paper instance + fade uniform for a piece that may stand in the sight line
  const fading = (name) => { const u = { value: 0 }; return { u, mat: addFade(materials.paper({ color: '#ffffff', side: THREE.DoubleSide, variant: 'site-fade:' + name }), u) }; };
  function place(group, [x, z], yaw = 0, fade = null) {
    group.updateMatrixWorld(true);
    const box = fade ? new THREE.Box3().setFromObject(group) : null; // rest (risen) pose, piece frame
    group.position.set(x, dip(x, z), z);
    group.rotation.y = yaw;
    group.updateMatrixWorld(true);
    root.add(group);
    const fold = createFoldInstance(group, { tileId: 'site:' + group.name });
    const meshes = [];
    group.traverse((o) => { if (o.isMesh) meshes.push(o); });
    pieces.push({ group, fold, x, z, r: group.userData.radius || 0.5, up: false, meshes, fade: 0, faded: false, u: fade && fade.u,
      inv: fade && group.matrixWorld.clone().invert(), boxIn: fade && box.clone().expandByScalar(FADE_IN), boxOut: fade && box.clone().expandByScalar(FADE_OUT) });
  }
  const placeFading = (build, name, xz, yaw) => { const f = fading(name); place(build(f.mat), xz, yaw, f); };

  place(buildArcade(paper), along(SITE.arcadeT), AXIS_YAW);
  placeFading((m) => buildLobby(m), 'lobby', ftToWorld(SITE.lobby.x, SITE.lobby.y), AXIS_YAW);
  SITE.poles.forEach((p, i) => placeFading((m) => buildPole('leaf_pole_' + i, m), 'leaf_pole_' + i, along(p.t, p.s), AXIS_YAW));

  // trees need the art atlas rects (public/textures/art/atlas.json, the same file life.js reads)
  fetch('./textures/art/atlas.json').then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))).then((atlas) => {
    SITE.trees.forEach((t, i) => {
      const sprite = atlas.sprites[t.sprite];
      if (!sprite) { console.warn('[site] missing atlas sprite', t.sprite); return; }
      placeFading((m) => buildTree('park_tree_' + i, sprite, atlas.size || [4096, 4096], m), 'park_tree_' + i, ftToWorld(t.x, t.y), 0.3 + i);
    });
  }).catch((err) => console.warn('[site] trees skipped: atlas.json failed:', err && err.message));

  let first = true;
  let forced = null; // debug: 1 = everything up, 0 = everything down, null = by distance

  function fadeStep(p, dt, trav) {
    const want = p.up && blocksSight(p, trav, camera, p.faded ? FADE_OUT : FADE_IN);
    p.faded = want;
    const target = want ? 1 : 0;
    if (p.fade === target) return;
    const step = first ? 1 : dt / FADE_TIME;
    p.fade = target > p.fade ? Math.min(1, p.fade + step) : Math.max(0, p.fade - step);
    p.u.value = p.fade;
    const cast = p.fade < 0.5; // a dissolved piece drops its shadow too
    if (p.meshes[0] && p.meshes[0].castShadow !== cast) for (const m of p.meshes) m.castShadow = cast;
  }

  return {
    group: root,
    archCount: ARCH_COUNT,
    update(dt, trav) {
      for (const p of pieces) {
        const d = Math.max(0, Math.hypot(trav.x - p.x, trav.z - p.z) - p.r);
        const want = forced !== null ? forced === 1 : (p.up ? d < FOLD : d < RISE);
        if (want !== p.up) {
          p.up = want;
          if (first) p.fold.snap(want ? 1 : 0); else p.fold.setTarget(want ? 1 : 0);
        }
        if (!p.fold.settled) p.fold.update(dt);
        if (p.u && camera) fadeStep(p, dt, trav);
      }
      first = false;
    },
    /** [wave4-I] The lens the sight-line fade tests against (main.js, once). */
    setCamera(cam) { camera = cam; },
    /** Debug / evidence: force every set-piece up (1), down (0) or back to distance rules (null). */
    debugForce(v) { forced = v; },
    /** Debug / evidence: what the site puts on the page: set-pieces and the names of their pieces. */
    debugPieces() {
      return pieces.map((p) => {
        const names = [];
        p.group.traverse((o) => { if (o !== p.group && o.name) names.push(o.name); });
        return { piece: p.group.name, up: p.up, fade: p.u ? +p.fade.toFixed(2) : null, names };
      });
    },
  };
}

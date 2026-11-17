// Domes site props (wave2-E): the world-space site print and the set-pieces that stand on it (entrance arcade, lobby,
// leaf poles, park trees). Each set-piece is ONE fold instance that rises whole when the traveller comes within
// RISE of its footprint and folds flat beyond FOLD (ARCHITECTURE.md §5.4 option A; same idea as the dome rise).
// Folded pieces stay drawn, lying flat on the page: there is no baked twin for a set-piece.
// Hooked from world.js: createSiteProps(...) at creation, site.update(dt, travellerPos) every frame.
import * as THREE from 'three';
import { TILE_SIZE } from '../../core/config.js';
import { createFoldInstance } from '../fold.js';
import { SITE, ftToWorld } from '../sitemap.js';
import { buildSitePrint } from './print.js';
import { buildArcade, buildLobby, buildPole, buildTree, ARCH_COUNT } from './pieces.js';

const RISE = 6; // world units from a piece's footprint (3 tiles)
const FOLD = 8.5; // hysteresis
const [AX, AY] = SITE.axis;
const along = (t, s = 0) => ftToWorld(SITE.lobby.x + AX * t - AY * s, SITE.lobby.y + AY * t + AX * s);
const AXIS_YAW = Math.atan2(AX, -AY); // local +Z -> south-west (world dir (AX, -AY) in x / z)

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
  function place(group, [x, z], yaw = 0) {
    group.position.set(x, dip(x, z), z);
    group.rotation.y = yaw;
    group.updateMatrixWorld(true);
    root.add(group);
    const fold = createFoldInstance(group, { tileId: 'site:' + group.name });
    pieces.push({ group, fold, x, z, r: group.userData.radius || 0.5, up: false });
  }

  place(buildArcade(paper), along(50), AXIS_YAW);
  place(buildLobby(paper), ftToWorld(SITE.lobby.x, SITE.lobby.y), AXIS_YAW);
  SITE.poles.forEach((p, i) => place(buildPole('leaf_pole_' + i, paper), along(p.t, p.s), AXIS_YAW));

  // trees need the art atlas rects (public/textures/art/atlas.json, the same file life.js reads)
  fetch('./textures/art/atlas.json').then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))).then((atlas) => {
    SITE.trees.forEach((t, i) => {
      const sprite = atlas.sprites[t.sprite];
      if (!sprite) { console.warn('[site] missing atlas sprite', t.sprite); return; }
      place(buildTree('park_tree_' + i, sprite, atlas.size || [4096, 4096], paper), ftToWorld(t.x, t.y), 0.3 + i);
    });
  }).catch((err) => console.warn('[site] trees skipped: atlas.json failed:', err && err.message));

  let first = true;
  let forced = null; // debug: 1 = everything up, 0 = everything down, null = by distance

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
      }
      first = false;
    },
    /** Debug / evidence: force every set-piece up (1), down (0) or back to distance rules (null). */
    debugForce(v) { forced = v; },
    /** Debug / evidence: what the site puts on the page: set-pieces and the names of their pieces. */
    debugPieces() {
      return pieces.map((p) => {
        const names = [];
        p.group.traverse((o) => { if (o !== p.group && o.name) names.push(o.name); });
        return { piece: p.group.name, up: p.up, names };
      });
    },
  };
}

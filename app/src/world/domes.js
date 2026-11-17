// The three Mitchell Park domes as pop-up set-pieces (ARCHITECTURE §5.4, option A: standalone, outside world.js).
//
// Per dome: two fold instances (fold.js), the main shell and the camera-side cutaway sector, both driven by the
// traveller's distance. Every card of all three domes is ONE instance of ONE BatchedMesh (one material: the printed
// vellum + lattice sheet), so the domes cost two draw calls (transparent double-sided = back + front pass) plus the
// shadow pass, and one more for the three apex halos.
//   rise:    traveller within RISE_AT of a dome's base ring  -> main + sector rise (whole dome, its own trigger)
//   fold:    beyond FOLD_AT (hysteresis)                      -> both fold back flat into the footprint
//   cutaway: traveller inside the base ring                   -> sector folds flat; leaving re-raises it
import * as THREE from 'three';
import { TILE_SIZE } from '../core/config.js';
import { createFoldInstance } from './fold.js';
import * as S from './domes/shell.js';
import { createPrint } from './domes/print.js';

const RISE_AT = 2 * TILE_SIZE; // ~2 tiles from the base ring (PROMPT.md "The domes")
const FOLD_AT = 3 * TILE_SIZE;
const IN_AT = S.BASE_R * 0.92; // inside the glass foot: cut away
const OUT_AT = S.BASE_R * 1.02;
/** Warm glow of the vellum panes at dusk / night, scaled by the day/night glow intensity (~4 day .. 15 night:
 * biomegrade.js). */
const PANE_GLOW = '#4a2b08';
/** By day the glass carries the sky: seen from below it is the blue of photo 02-int/18, from outside a cool sheen
 * (photo 01-ext/14). Same glow list scaling. */
const SKY_GLOW = '#4f6684';
/** Blue-white apex halo (photo 01-exterior/12, concept frame 01). Dim colour: the glow list multiplies it. */
const HALO_GLOW = '#6f8fbb';
/** [wave6-P] Lantern look: the inner light passes straight through where the card faces the eye and grazes off at the
 * silhouette, so pane centres glow and rims fall dark (concept frame 01). Applied to the emissive term only. */
const FACING_GLOW = `
{
  float paperFacing = abs( dot( normal, normalize( vViewPosition ) ) );
  totalEmissiveRadiance *= mix( 0.3, 1.35, paperFacing * paperFacing );
}
`;
/** Day = the real glass building; dusk / night = paper lantern (print.js LOOKS). */
const lookOf = (mode) => (mode === 'day' ? 'day' : 'lantern');

export function createDomes({ scene, materials }) {
  const geos = S.buildGeometries();
  const print = createPrint();
  const material = materials.paper({ map: print.map, transparent: true, emissive: PANE_GLOW, emissiveIntensity: 3, vary: false, variant: 'dome' });
  material.emissiveMap = print.emissiveMap;
  // vellum: the paper shader writes alpha = die-cut coverage only (materials.js `gl_FragColor.a = gPaperCov`); this
  // material alone also keeps the print's alpha, so the panes are translucent
  const paperCompile = material.onBeforeCompile; const paperKey = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, r) => {
    paperCompile.call(material, shader, r);
    shader.fragmentShader = shader.fragmentShader.replace('gl_FragColor.a = gPaperCov;', 'gl_FragColor.a = gPaperCov * diffuseColor.a;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + FACING_GLOW);
  };
  material.customProgramCacheKey = () => paperKey.call(material) + '|vellum';
  material.forceSinglePass = true; // cards are separate instances sorted back to front: no back/front double pass needed
  material.needsUpdate = true;

  const geoKeys = [...geos.byKey.keys()]; // tiers, ring, cap + the [wave4-J] doorway variants (notched tier 1, broken ring)
  const geoList = geoKeys.map((k) => geos.byKey.get(k));
  const geoIndex = (key) => geoKeys.indexOf(key);
  const centres = S.domeCentres();
  const domes = centres.map((c) => {
    const { main, sector, cap } = S.buildDome(geos, c.id);
    main.position.set(c.x, 0, c.z); sector.position.set(c.x, 0, c.z);
    return { ...c, groups: [main, sector], cap,
      folds: [createFoldInstance(main, { tileId: c.id, staggerSpan: S.STAGGER_SPAN }), createFoldInstance(sector, { tileId: c.id + '_cut', staggerSpan: S.STAGGER_SPAN })],
      anchors: [S.anchorsOf(main), S.anchorsOf(sector)], ids: [[], []], want: 0, inside: false };
  });

  const instances = domes.reduce((n, d) => n + d.anchors[0].length + d.anchors[1].length, 0);
  const verts = geoList.reduce((n, g) => n + g.attributes.position.count, 0);
  const index = geoList.reduce((n, g) => n + g.index.count, 0);
  const batch = new THREE.BatchedMesh(instances, verts, index, material);
  batch.name = 'domes';
  const gid = geoList.map((g) => batch.addGeometry(g));
  batch.castShadow = true;
  batch.receiveShadow = true;
  batch.frustumCulled = false; // per-instance culling instead (bounds change as the cards fold)
  batch.perObjectFrustumCulled = true;
  // shadows through the die-cut lattice only: panes (alpha < 0.5) cast none
  batch.customDepthMaterial = new THREE.MeshDepthMaterial({ map: print.map, alphaTest: 0.5 });
  for (const d of domes) for (let k = 0; k < 2; k++) for (const a of d.anchors[k]) d.ids[k].push(batch.addInstance(gid[geoIndex(a.userData.geo)]));
  scene.add(batch);

  // apex halos: one InstancedMesh, riding on each cap
  const haloMat = materials.paper({ color: '#eef4ff', emissive: HALO_GLOW, emissiveIntensity: 3, fibre: 'none', vary: false, variant: 'dome-halo' });
  const halo = new THREE.InstancedMesh(new THREE.TorusGeometry(S.LAYOUT.cap.r * 1.2, 0.09, 10, 48), haloMat, domes.length);
  halo.name = 'dome-halos';
  halo.frustumCulled = false;
  scene.add(halo);
  const capAnchor = domes.map((d) => d.cap.anchor);
  const haloLocal = new THREE.Matrix4().makeTranslation(0, geos.capHub, S.CAP_T / 2 + 0.02);
  const _m = new THREE.Matrix4();

  function write(d, k) {
    d.groups[k].updateMatrixWorld(true);
    const ids = d.ids[k]; const an = d.anchors[k];
    for (let i = 0; i < ids.length; i++) batch.setMatrixAt(ids[i], an[i].matrixWorld);
    if (k === 0) { const i = domes.indexOf(d); halo.setMatrixAt(i, _m.multiplyMatrices(capAnchor[i].matrixWorld, haloLocal)); halo.instanceMatrix.needsUpdate = true; }
  }
  for (const d of domes) { write(d, 0); write(d, 1); }

  /** Evidence / debug: { rise: null|0|1, cut: null|0|1 } overrides the triggers for every dome. */
  const override = { rise: null, cut: null };

  // [wave6-P] day: clear glass + dark apex skylight ring; dusk / night: amber lantern + lit halo. Repainted on change only.
  let look = null;
  function setLook(next) {
    look = next;
    print.paint(next);
    const lantern = next === 'lantern';
    material.emissive.set(lantern ? PANE_GLOW : SKY_GLOW);
    haloMat.color.set(lantern ? '#f2f6ff' : '#34322d');
    haloMat.emissive.set(lantern ? HALO_GLOW : 0x000000);
  }

  const api = {
    domes, batch, halo, material, override, geos,
    /** The day/night controller (main.js sets it once created); its mode picks the look. */
    daynight: null,
    /** Per frame, after the traveller moved. p = traveller position (world units). */
    update(dt, p) {
      const want = lookOf(api.daynight ? api.daynight.mode : 'day');
      if (want !== look) setLook(want);
      for (const d of domes) {
        const dist = Math.hypot(p.x - d.x, p.z - d.z);
        const edge = dist - S.BASE_R;
        if (override.rise !== null) d.want = override.rise ? 1 : 0;
        else if (edge < RISE_AT) d.want = 1;
        else if (edge > FOLD_AT) d.want = 0;
        if (dist < IN_AT) d.inside = true; else if (dist > OUT_AT) d.inside = false;
        const cut = override.cut !== null ? !!override.cut : d.inside;
        d.folds[0].setTarget(d.want);
        d.folds[1].setTarget(d.want && !cut ? 1 : 0);
        for (let k = 0; k < 2; k++) {
          const f = d.folds[k];
          if (f.settled) continue;
          f.update(dt);
          write(d, k);
        }
      }
    },
  };
  return api;
}

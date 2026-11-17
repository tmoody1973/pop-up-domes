// Code-built tile prototypes for the Domes site, registered by the asset loader (assets/loader.js) under their MODELS
// ids. site_lawn = the meadow tile's ground print alone: no tufts, flowers, hay, fence or any other stand-up, so the
// page prints plain park lawn (its flat twin = its base, so no folded "flower stamp" either).
import * as THREE from 'three';

/** model id -> (getProto(id) -> prototype Group) */
export const SITE_TILE_BUILDERS = {
  site_lawn(getProto) {
    const g = new THREE.Group();
    g.name = 'site_lawn';
    g.userData.model = 'site_lawn';
    const base = getProto('meadow').getObjectByName('base');
    if (!base) throw new Error('[site] meadow tile has no base print');
    g.add(base.clone()); // shares the meadow base geometry + material
    g.updateMatrixWorld(true);
    return g;
  },
};

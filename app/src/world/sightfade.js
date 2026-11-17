// [fade] Sight-line fade, shared by site/index.js (set-pieces), interiors/index.js (planting cards) and domes.js (shell
// cards). The camera never yaws (the cutaway sector is built on the +Z camera side), so whatever stands between the
// traveller and the lens has to get out of the way: a card whose box (in its own frame) cuts the segment from his feet
// or head to the camera fades. Grown by FADE_IN to start, it must clear FADE_OUT to come back (hysteresis: no flicker
// along an edge). Collision is untouched: only the look changes.
import * as THREE from 'three';
import { CONFIG } from '../core/config.js';

export const FADE_IN = 0.15; // box margin (world units) that starts a fade
export const FADE_OUT = 0.45; // larger margin that must clear before the card comes back
export const FADE_TIME = 0.3; // seconds for a full fade
const SIGHT_H = [0.08, CONFIG.TRAVELLER_HEIGHT]; // feet and head

/** GLSL: 4x4 Bayer threshold (0..1), the same pattern the wave4-I site fade dithers with. */
export const BAYER_GLSL = 'float siteBayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }\n'
  + 'float siteBayer4(vec2 p) { return siteBayer2(0.5 * p) * 0.25 + siteBayer2(p) + 0.03; }';

const _o = new THREE.Vector3(); const _d = new THREE.Vector3(); const _hit = new THREE.Vector3(); const _ray = new THREE.Ray();
/** Does the segment traveller (feet / head) -> camera cross `box` (in the frame whose world->local matrix is `inv`)? */
export function blocksSight(inv, box, trav, cam) {
  for (const h of SIGHT_H) {
    _o.set(trav.x, trav.y + h, trav.z).applyMatrix4(inv); // both ends in the box's frame (frames may be scaled)
    _d.copy(cam.position).applyMatrix4(inv).sub(_o);
    const len = _d.length();
    _ray.set(_o, _d.divideScalar(len || 1));
    if (_ray.intersectBox(box, _hit) && _hit.distanceTo(_o) < len) return true;
  }
  return false;
}

const _inv = new THREE.Matrix4(); const _box = new THREE.Box3();
/**
 * Per-instance fades for a BatchedMesh whose instances are `anchors[i]` (their matrixWorld is the instance matrix) with
 * local bounds `boxes[i]`. step(dt, trav, cam, active) tests the instances, eases each fade over FADE_TIME and calls
 * write(instanceId, fade) only when a value changes. active = false fades everything back.
 */
export function createBatchFade(ids, anchors, boxes, write) {
  const fade = new Float32Array(ids.length);
  const faded = new Uint8Array(ids.length);
  return {
    fade,
    count() { let n = 0; for (let i = 0; i < fade.length; i++) if (fade[i] > 0.5) n++; return n; },
    /** true while any instance is not at rest at 0. */
    busy() { for (let i = 0; i < fade.length; i++) if (fade[i] > 0 || faded[i]) return true; return false; },
    step(dt, trav, cam, active) {
      for (let i = 0; i < ids.length; i++) {
        let want = false;
        if (active) {
          _inv.copy(anchors[i].matrixWorld).invert();
          _box.copy(boxes[i]).expandByScalar(faded[i] ? FADE_OUT : FADE_IN);
          want = blocksSight(_inv, _box, trav, cam);
        }
        faded[i] = want ? 1 : 0;
        const target = want ? 1 : 0;
        if (fade[i] === target) continue;
        const s = dt / FADE_TIME;
        fade[i] = target > fade[i] ? Math.min(1, fade[i] + s) : Math.max(0, fade[i] - s);
        write(ids[i], fade[i]);
      }
    },
  };
}

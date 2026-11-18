// High-angle macro follow camera.
//
// - Long lens (fov ~27), ~53 deg down, north up: the look of a tilt-shift macro shot of a miniature.
// - The look target is a critically damped spring (exact integration, so it behaves the same at any
//   frame rate) chasing a point that leads the traveller in its movement direction; the steady-state
//   lag of the spring is pre-compensated, so the lead on screen is exactly `lookAhead`.
// - The target sits `screenUp` units toward the top of the screen from the traveller, so the traveller
//   stands a little below centre and the tiles rising ahead (north) are inside the frame.
// - A very slow, tiny drift keeps the frame alive like a hand-set tripod head (deterministic).
// - focusPoint / focusDistance (the traveller chest) feed the depth of field.
// - [wave3-F] Dome proximity (CONFIG.camera.dome, decision 005): near a dome the active pose is blended toward a low,
//   wider "approach" pose, and inside a dome toward an "inside" pose. The weights are smooth functions of the traveller's
//   position only, so the lens glides with his walk; yaw stays 0 (the cutaway sector is fixed on the +Z side).
import * as THREE from 'three';
import { CONFIG, TILE_SIZE } from '../core/config.js';
import { sight } from '../world/world.js';
import { state } from '../core/state.js';
import { domeCentres, BASE_R } from '../world/domes/shell.js';

const DEG = Math.PI / 180;
const TWO_PI = Math.PI * 2;
const DOME_KEYS = ['pitchDeg', 'distance', 'fov', 'targetHeight', 'screenUp'];
const DOMES = domeCentres();
/** 0 at a, 1 at b (either order), smooth in between. */
const ramp = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function createFollowCamera({ aspect = 16 / 9 } = {}) {
  const C = CONFIG.camera;
  const camera = new THREE.PerspectiveCamera(C.fov, aspect, C.near, C.far);
  camera.name = 'follow-camera';
  let base = { ...C }; // the pose views.js asks for (journey = the defaults)
  const pose = { ...C }; // what the lens uses this frame: base blended toward the dome poses (refreshed in blendPose)
  const D = C.dome;
  const dome = { approach: 0, inside: 0 }; // last weights (debug / evidence)
  const target = new THREE.Vector3(); // smoothed look-at point
  const targetVel = new THREE.Vector3(); // spring velocity of the look-at point
  const focusPoint = new THREE.Vector3(); // what must be sharp (the traveller chest)
  const _want = new THREE.Vector3();
  const prevGoal = new THREE.Vector3(); // goal of the previous update
  const _right = new THREE.Vector3();
  const _up = new THREE.Vector3();
  let clock = 0; // drift clock (sum of dt since the last snap)

  // ---- sight assist ---------------------------------------------------------------------------
  // When a LARGE piece (house, tower, stall: what world.js make-room cannot tip aside) hides the traveller for longer than
  // assist.delay seconds, the lens eases a little: up by at most pitchMax degrees and / or round by at most yawMax, the
  // first candidate that clears him. It eases back once the plain view has been clear for assist.release seconds. The
  // offsets are added to the active pose (so they compose with the V views) and are critically damped: no jerk.
  // Off for steep poses (map) and while the atlas page is open.
  const AS = C.assist || { enabled: false };
  const AS_HEIGHTS = [0.35, 0.65, 0.95]; // fractions of TRAVELLER_HEIGHT: thigh, chest, hat
  let aYaw = 0; let aPitch = 0; let aYawV = 0; let aPitchV = 0; // eased offsets (degrees) and their rates
  let gYaw = 0; let gPitch = 0; // goals
  let occT = 0; let clearT = 0; let checkT = 0; let heldT = 0;
  let gate = null; // optional () => boolean: true = assist paused (atlas page open)
  const _cam = new THREE.Vector3();
  /** Rays (of 3) from the figure to where the lens would stand with these offsets that a large piece blocks. */
  function assistBlocked(traveller, yawOff, pitchOff) {
    const w = sight.world;
    if (!w || !w.sightBlocked) return 0;
    const yaw = (pose.yawDeg + yawOff) * DEG;
    const pitch = Math.min(80, pose.pitchDeg + pitchOff) * DEG;
    const h = Math.cos(pitch) * pose.distance;
    _cam.set(target.x + Math.sin(yaw) * h, target.y + Math.sin(pitch) * pose.distance, target.z + Math.cos(yaw) * h);
    let n = 0;
    for (let i = 0; i < AS_HEIGHTS.length; i++) {
      const ox = traveller.position.x; const oy = traveller.position.y + CONFIG.TRAVELLER_HEIGHT * AS_HEIGHTS[i]; const oz = traveller.position.z;
      let dx = _cam.x - ox; let dy = _cam.y - oy; let dz = _cam.z - oz;
      const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
      if (w.sightBlocked(ox, oy, oz, dx, dy, dz, l - camera.near)) n++;
    }
    return n;
  }
  function assistOn() {
    if (AS.enabled === false || pose.pitchDeg > 60) return false;
    return gate === null || !gate();
  }
  function assistPick(traveller, baseN) {
    const P = AS.pitchMax ?? 10; const Y = AS.yawMax ?? 14;
    // gentlest first: a small lift, a small slide either way, then the full amounts, then both together
    const cand = [[0, P * 0.5], [Y * 0.5, 0], [-Y * 0.5, 0], [0, P], [Y, 0], [-Y, 0], [Y * 0.5, P * 0.5], [-Y * 0.5, P * 0.5], [Y, P], [-Y, P]];
    let best = -1; let bestN = baseN;
    for (let i = 0; i < cand.length; i++) {
      if (pose.pitchDeg + cand[i][1] > 62) continue;
      const n = assistBlocked(traveller, cand[i][0], cand[i][1]);
      if (n < bestN) { bestN = n; best = i; if (n === 0) break; }
    }
    // still partly hidden (he stands right behind a house): one wider tier, far x the amounts, taken only when it shows more of him
    if (bestN >= 1 && (AS.far ?? 1) > 1) {
      const f = AS.far; const c2 = [[0, P * f], [Y * f, P], [-Y * f, P], [Y * f, P * f], [-Y * f, P * f]];
      for (let i = 0; i < c2.length; i++) {
        if (pose.pitchDeg + c2[i][1] > 62) continue;
        const n = assistBlocked(traveller, c2[i][0], c2[i][1]);
        if (n < bestN) { bestN = n; best = cand.length; cand.push(c2[i]); if (n === 0) break; }
      }
    }
    if (best >= 0) { gYaw = cand[best][0]; gPitch = cand[best][1]; heldT = 0; }
  }
  /** One step of the assist: decide (10 times a second), then ease. `force` (snap) decides and arrives at once. */
  function updateAssist(dt, traveller, force) {
    if (!assistOn()) { gYaw = 0; gPitch = 0; occT = 0; clearT = 0; } else {
      checkT -= dt; heldT += dt;
      if (checkT <= 0 || force) {
        const step = force ? 0 : (AS.interval ?? 0.1);
        checkT = AS.interval ?? 0.1;
        const baseN = assistBlocked(traveller, 0, 0);
        const hidden = baseN >= 2; // two of thigh / chest / hat covered
        if (hidden) { occT += step; clearT = 0; } else { clearT += step; occT = 0; }
        if (gYaw === 0 && gPitch === 0) {
          if (hidden && (force || occT >= (AS.delay ?? 0.4))) assistPick(traveller, baseN);
        } else if (!hidden) {
          if (clearT >= (AS.release ?? 0.6)) { gYaw = 0; gPitch = 0; }
        } else if (heldT > (AS.rethink ?? 1.2) && assistBlocked(traveller, gYaw, gPitch) >= 2) {
          // the chosen offset no longer clears him (he walked on behind the house): look again, from the gentlest
          const py = gYaw; const pp = gPitch; gYaw = 0; gPitch = 0;
          assistPick(traveller, baseN);
          if (gYaw === 0 && gPitch === 0) { gYaw = py; gPitch = pp; heldT = 0; }
        }
      }
    }
    if (force) { aYaw = gYaw; aPitch = gPitch; aYawV = 0; aPitchV = 0; return; }
    if (dt <= 0) return;
    // critically damped (exact step), like the look target
    const om = 2 / Math.max(0.05, AS.ease ?? 0.7); const e = Math.exp(-om * dt);
    let d = aYaw - gYaw; let tmp = (aYawV + om * d) * dt; aYawV = (aYawV - om * tmp) * e; aYaw = gYaw + (d + tmp) * e;
    d = aPitch - gPitch; tmp = (aPitchV + om * d) * dt; aPitchV = (aPitchV - om * tmp) * e; aPitch = gPitch + (d + tmp) * e;
    if (gYaw === 0 && Math.abs(aYaw) < 1e-3 && Math.abs(aYawV) < 1e-3) { aYaw = 0; aYawV = 0; }
    if (gPitch === 0 && Math.abs(aPitch) < 1e-3 && Math.abs(aPitchV) < 1e-3) { aPitch = 0; aPitchV = 0; }
  }

  function wanted(traveller, steady) {
    const yaw = (pose.yawDeg + aYaw) * DEG;
    // ground-plane screen axes: "up the screen" and "screen right"
    const ux = -Math.sin(yaw);
    const uz = -Math.cos(yaw);
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    const v = traveller.velocity;
    // lead = look-ahead + compensation of the spring lag (lag of a critically damped follower = v * smoothTime)
    const lead = pose.lookAhead / CONFIG.player.speed + (steady ? 0 : pose.smoothTime);
    // extra lead for the part of the motion that runs down the screen (toward the camera)
    const down = Math.max(0, -(v.x * ux + v.z * uz));
    const extra = (Math.max(pose.lookAheadSouth ?? pose.lookAhead, pose.lookAhead) - pose.lookAhead) * down / CONFIG.player.speed;
    const su = pose.screenUp || 0;
    const sr = pose.screenRight || 0;
    _want.set(
      traveller.position.x + v.x * lead - ux * extra + ux * su + rx * sr,
      traveller.position.y + (pose.targetHeight || 0),
      traveller.position.z + v.z * lead - uz * extra + uz * su + rz * sr,
    );
    return _want;
  }

  /** Dome weights at world point p: approach (1 at a base ring) x guard (no dome between the low lens and him), inside. */
  function domeWeights(p) {
    const start = (D.startTiles ?? 4) * TILE_SIZE;
    const G = D.guard; const reach = G.reach + BASE_R; // a dome whose centre is further south than this stands behind the lens
    let keepA = 1; let keepI = 1; let clear = 1;
    for (let i = 0; i < DOMES.length; i++) {
      const dx = p.x - DOMES[i].x; const south = DOMES[i].z - p.z; // > 0: the dome lies toward the camera
      const edge = Math.hypot(dx, south) - BASE_R; // > 0 outside the glass foot
      keepA *= 1 - ramp(start, 0, edge);
      keepI *= 1 - ramp(0, -(D.insideDepth ?? 2), edge);
      // any dome in the strip between him and the low lens (|dx| < R, toward the camera, not past it) vetoes the low pose
      clear *= 1 - (1 - ramp(G.lateral[0], G.lateral[1], Math.abs(dx) / BASE_R)) * ramp(G.near[0] * BASE_R, G.near[1] * BASE_R, south) * ramp(reach + 1, reach - 1, south);
    }
    dome.approach = (1 - keepA) * clear; dome.inside = 1 - keepI;
  }
  /** pose = base, blended toward approach then inside by the dome weights x base.domeMix (views: journey only). */
  function blendPose(traveller) {
    Object.assign(pose, base);
    const mix = base.domeMix ?? 1;
    if (!D || mix <= 0) { dome.approach = 0; dome.inside = 0; return; }
    domeWeights(traveller.position);
    const wa = dome.approach * mix; const wi = dome.inside * mix;
    if (wa === 0 && wi === 0) return;
    for (const k of DOME_KEYS) {
      const b = base[k] ?? 0;
      const a = b + ((D.approach[k] ?? b) - b) * wa;
      pose[k] = a + ((D.inside[k] ?? a) - a) * wi;
    }
  }

  // ---- user zoom (wheel / pinch / + -) ----
  // ponytail: max zoom keeps the lens inside the room box (walls ~50 u from the book, ceiling 70 u up).
  const Z = { min: 0.45, max: 3.8, mapFrom: 1.3, mapTo: 3.0, mapPitchDeg: 58, mapFov: 45, ease: 9 };
  let zoom = 1; let zoomGoal = 1;
  // [phone] tall screens (portrait phones) crop the sides: pull back by sqrt(1.6 / aspect), capped, so the domes stay in frame
  const fitFor = (a) => Math.min(1.8, Math.max(1, Math.sqrt(1.6 / a)));
  let fit = fitFor(aspect);
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  function setFocus(traveller) {
    focusPoint.copy(traveller.position);
    focusPoint.y += CONFIG.TRAVELLER_HEIGHT * (pose.focusHeight ?? 0.6);
  }

  function place() {
    // user zoom: distance x zoom; zooming out also blends toward a high, wider map view so the book stays in frame
    const zt = smooth(Z.mapFrom, Z.mapTo, zoom);
    const pitchDeg = pose.pitchDeg + aPitch + (Z.mapPitchDeg - (pose.pitchDeg + aPitch)) * zt;
    const fov = pose.fov + (Z.mapFov - pose.fov) * zt;
    const dist = pose.distance * zoom * fit;
    const pitch = pitchDeg * DEG;
    const yaw = (pose.yawDeg + aYaw) * DEG;
    const h = Math.cos(pitch) * dist;
    camera.position.set(target.x + Math.sin(yaw) * h, target.y + Math.sin(pitch) * dist, target.z + Math.cos(yaw) * h);
    camera.up.set(0, 1, 0);
    if (pitchDeg >= 88.5) camera.up.set(-Math.sin(yaw), 0, -Math.cos(yaw)); // straight down: keep north up
    const amp = pose.driftAmp || 0;
    if (amp > 0 && pitchDeg < 88.5) {
      // slow drift across and along the lens axis plane; the look target does not move
      const w = TWO_PI * (pose.driftHz || 0.07);
      const a = amp * Math.sin(clock * w);
      const b = amp * 0.6 * Math.sin(clock * w * 1.37 + 1.7);
      _right.set(Math.cos(yaw), 0, -Math.sin(yaw));
      _up.set(-Math.sin(yaw) * Math.sin(pitch), Math.cos(pitch), -Math.cos(yaw) * Math.sin(pitch));
      camera.position.addScaledVector(_right, a).addScaledVector(_up, b);
    }
    // never let the lens sink into the page or the near plane cut the paper under it
    const minY = target.y + camera.near + 0.35;
    if (camera.position.y < minY) camera.position.y = minY;
    // world.js make-room: how steeply the sight line climbs from the traveller to the lens. [wave3-F] measured, not the
    // axis pitch: the dome poses lift the look target, so the axis is shallower than the line to him.
    state.camPitch = Math.atan2(camera.position.y - focusPoint.y, Math.hypot(camera.position.x - focusPoint.x, camera.position.z - focusPoint.z)) / DEG;
    camera.lookAt(target);
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
  }

  /** Exact critically damped spring step for one axis (stable and frame-rate independent). */
  function damp(axis, goal, omega, e, dt) {
    const d = target[axis] - goal;
    const tmp = (targetVel[axis] + omega * d) * dt;
    targetVel[axis] = (targetVel[axis] - omega * tmp) * e;
    target[axis] = goal + (d + tmp) * e;
  }

  return {
    /** The THREE.PerspectiveCamera used for rendering and raycasting. */
    camera,
    target,
    focusPoint,
    /** Distance from the camera to focusPoint (world units) - for depth-of-field. */
    get focusDistance() { return camera.position.distanceTo(focusPoint); },
    get pose() { return pose; },
    /** Dome-proximity weights of the last update: { approach, inside } in 0..1. */
    get dome() { return dome; },
    /** Pause sight assist when fn() returns true, such as while the atlas page is open. */
    setAssistGate(fn) { gate = fn || null; },
    update(dt, traveller) {
      blendPose(traveller);
      if (dt > 0) {
        clock += dt;
        const goal = wanted(traveller);
        const omega = 2 / Math.max(0.01, pose.smoothTime);
        const e = Math.exp(-omega * dt);
        // chase the goal at the middle of the step (second-order accurate for a moving goal, so the
        // camera path does not depend on the frame rate)
        damp('x', (goal.x + prevGoal.x) * 0.5, omega, e, dt);
        damp('y', (goal.y + prevGoal.y) * 0.5, omega, e, dt);
        damp('z', (goal.z + prevGoal.z) * 0.5, omega, e, dt);
        prevGoal.copy(goal);
        updateAssist(dt, traveller, false);
      }
      if (dt > 0) zoom = Math.exp(Math.log(zoom) + (Math.log(zoomGoal) - Math.log(zoom)) * (1 - Math.exp(-Z.ease * dt))); // eased in log space
      setFocus(traveller);
      place();
    },
    /** User zoom (1 = default framing; < 1 closer, > 1 further out). zoomBy multiplies the goal; the view eases to it. */
    get zoom() { return zoom; },
    zoomBy(f) { zoomGoal = Math.min(Z.max / fit, Math.max(Z.min, zoomGoal * f)); }, // max / fit: the lens stays inside the room
    resetZoom() { zoomGoal = 1; },
    /** Place the camera at the traveller's initial position without smoothing. */
    snap(traveller) {
      blendPose(traveller);
      aYaw = 0; aPitch = 0; gYaw = 0; gPitch = 0; aYawV = 0; aPitchV = 0; occT = 0; clearT = 0; checkT = 0;
      target.copy(wanted(traveller, true)); // where the spring would sit in steady state
      updateAssist(0, traveller, true);
      if (aYaw !== 0) target.copy(wanted(traveller, true));
      prevGoal.copy(wanted(traveller));
      targetVel.set(traveller.velocity.x, 0, traveller.velocity.z);
      clock = 0;
      setFocus(traveller);
      place();
    },
    /** Override any of {distance,pitchDeg,yawDeg,fov,lookAhead,smoothTime,screenUp,screenRight,targetHeight,driftAmp}; null restores the defaults. */
    setPose(overrides) {
      base = { ...C, ...(overrides || {}) };
    },
    setAspect(a) {
      camera.aspect = a;
      fit = fitFor(a); zoomGoal = Math.min(zoomGoal, Z.max / fit);
      camera.updateProjectionMatrix();
    },
  };
}

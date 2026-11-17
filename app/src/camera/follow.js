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
import * as THREE from 'three';
import { CONFIG } from '../core/config.js';
import { sight } from '../world/world.js';
import { state } from '../core/state.js';

const DEG = Math.PI / 180;
const TWO_PI = Math.PI * 2;

export function createFollowCamera({ aspect = 16 / 9 } = {}) {
  const C = CONFIG.camera;
  const camera = new THREE.PerspectiveCamera(C.fov, aspect, C.near, C.far);
  camera.name = 'follow-camera';
  let pose = { ...C };
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

  function setFocus(traveller) {
    focusPoint.copy(traveller.position);
    focusPoint.y += CONFIG.TRAVELLER_HEIGHT * (pose.focusHeight ?? 0.6);
  }

  function place() {
    const pitch = (pose.pitchDeg + aPitch) * DEG;
    const yaw = (pose.yawDeg + aYaw) * DEG;
    const h = Math.cos(pitch) * pose.distance;
    camera.position.set(target.x + Math.sin(yaw) * h, target.y + Math.sin(pitch) * pose.distance, target.z + Math.cos(yaw) * h);
    camera.up.set(0, 1, 0);
    if (pose.pitchDeg + aPitch >= 88.5) camera.up.set(-Math.sin(yaw), 0, -Math.cos(yaw)); // straight down: keep north up
    const amp = pose.driftAmp || 0;
    if (amp > 0 && pose.pitchDeg < 88.5) {
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
    state.camPitch = pose.pitchDeg + aPitch; // world.js make-room: how steeply the sight line climbs
    camera.lookAt(target);
    if (camera.fov !== pose.fov) { camera.fov = pose.fov; camera.updateProjectionMatrix(); }
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
    /** Pause sight assist when fn() returns true, such as while the atlas page is open. */
    setAssistGate(fn) { gate = fn || null; },
    update(dt, traveller) {
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
      setFocus(traveller);
      place();
    },
    /** Place the camera at the traveller's initial position without smoothing. */
    snap(traveller) {
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
      pose = { ...C, ...(overrides || {}) };
    },
    setAspect(a) {
      camera.aspect = a;
      camera.updateProjectionMatrix();
    },
  };
}

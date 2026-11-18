// Pop-up Atlas composition root.
// URL params: ?seed=N  ?quality=low|med|high  ?mute=1  ?hint=0  ?night=1  ?dusk=1 (N cycles day / dusk / night)  ?life=0  ?animals=0  ?debug=1 (window.__domes)
import * as THREE from 'three';
import { CONFIG, QUALITY, TILE_SIZE } from './core/config.js';
import { bus } from './core/events.js';
import { state } from './core/state.js';
import { createLoop } from './core/loop.js';
import { loadAssets } from './assets/loader.js';
import { createSiteMap } from './world/sitemap.js';
import { createWorld } from './world/world.js';
import { createTraveller } from './player/traveller.js';
import { createControls } from './player/controls.js';
import { createFollowCamera } from './camera/follow.js';
import { createRenderer } from './render/renderer.js';
import { createLights } from './render/lights.js';
import { createPost } from './render/post.js';
import { createMaterials } from './render/materials.js';
import { createPaperAudio } from './audio/paper.js';
import { createMusic } from './audio/music.js';
import { createDayNight } from './render/daynight.js';
import { createLife } from './life/life.js';
import { createAnimals } from './life/animals.js';
import { createViews } from './camera/views.js';
import { createZoom } from './camera/zoom.js';
import { createAutoQuality } from './render/autoquality.js';
import { createDomes } from './world/domes.js';
// Allocation-free two-dimensional length.
const hypot2 = (a, b) => Math.sqrt(a * a + b * b);

const params = new URLSearchParams(location.search);
const seedParam = parseInt(params.get('seed') ?? '', 10);
const seed = Number.isFinite(seedParam) ? seedParam : CONFIG.DEFAULT_SEED;
const quality = QUALITY[params.get('quality')] ? params.get('quality') : CONFIG.DEFAULT_QUALITY;
const muted = params.get('mute') === '1';
const showHint = params.get('hint') !== '0';
// [intro] opening overview: whole book, every dome up, title on screen; the first tap / key glides down to the traveller. ?intro=0 skips.
const intro = showHint && params.get('intro') !== '0';
const introDusk = intro && params.get('dusk') !== '1' && params.get('night') !== '1'; // opens at dusk (lantern domes), fades to day on start
let introOn = intro;
let introLook = null; // stand-in the camera follows during the intro (set at start)
const INTRO_TOWARD_DOMES = 0.6; // 0 = framed on the traveller, 1 = on the middle of the three domes
const HINT_HOLD_MS = 9000; // [hint] how long the controls line stays up after the intro closes (then its 1.4 s CSS fade)

state.seed = seed;
state.quality = quality;

async function boot() {
  const canvas = document.getElementById('atlas');
  const hint = document.getElementById('hint');

  const scene = new THREE.Scene();
  const { renderer, setSize: setRendererSize, setQuality: setRendererQuality } = createRenderer({ canvas, quality });
  const materials = createMaterials({ quality });
  const assets = await loadAssets({ materials, renderer, quality });
  materials.setTextures(assets.textures);
  const lights = createLights({ scene, quality });
  const wfc = createSiteMap({ seed }); // the Mitchell Park site map (same contract as the old createWFC)
  const world = createWorld({ scene, assets, wfc, materials, quality });
  const traveller = createTraveller({ scene, assets, world, materials });
  const domes = params.get('domes') === '0' ? null : createDomes({ scene, materials }); // the three dome set-pieces (?domes=0 disables)
  if (domes) world.collide.setDomes(domes); // wave3-G: risen dome rings block, doorways pass
  const follow = createFollowCamera({ aspect: window.innerWidth / Math.max(1, window.innerHeight) });
  world.site.setCamera(follow.camera); // wave4-I: site set-pieces in the sight line fade (world/site/index.js)
  const controls = createControls({ domElement: canvas, camera: follow.camera, traveller });
  const views = createViews({ follow }); // V cycles camera views
  // wheel / pinch / + - 0 zoom; [phone] 2 / 3 / 4-finger tap = N (day / dusk / night) / V (view) / M (music), the walk its first finger began is cancelled
  createZoom({ domElement: canvas, follow, onTap: (n) => { controls.clearTarget(); if (n === 2) daynight.toggle(); else if (n === 3) views.next(); else music.toggle(); } });
  const post = createPost({ renderer, scene, camera: follow.camera, quality });
  const audio = createPaperAudio({ muted });
  const music = createMusic({ audio });
  const daynight = createDayNight({ scene, night: params.get('night') === '1', dusk: params.get('dusk') === '1' || introDusk });
  if (domes) domes.daynight = daynight; // [wave6-P] the domes pick their look (glass by day, lantern at dusk) from its mode
  if (domes) domes.camera = follow.camera; // [fade] dome shells / interior cards in the sight line fade (world/sightfade.js)
  // ambient life + weather (leaves, snow, rain, birds, chimney smoke, fireflies ...): 2 draw calls; ?life=0 disables it
  const life = params.get('life') === '0' || CONFIG.life.enabled === false ? null : createLife({ scene, assets, wfc, world, daynight, camera: follow.camera, quality, seed });
  // living animals (cats, sheep, hens, ducks ...): cut-paper cards on risen tiles, 2 draw calls; ?animals=0 disables them
  const animals = params.get('animals') === '0' || CONFIG.animals.enabled === false ? null : createAnimals({ scene, renderer, world, wfc, traveller, daynight, assets, seed, quality });
  // Gameplay progress is saved independently for each world seed.
  // ponytail: game layer (scraps, lanterns, atlas map) stubbed until the site reads right (LOG.md [wave1-A]).
  const game = { modal: () => false, update() {}, atlasmap: { render() {} } };
  if (params.get('debug') === '1') window.__domes = { follow, views, traveller, world, siteMap: wfc, controls, state, CONFIG, domes, renderer, scene };
  const interiors = domes ? await (await import('./world/interiors/index.js')).createInteriors({ scene, materials, domes, daynight }) : null; // wave3-H dome planting
  follow.setAssistGate(game.modal);
  // N: day / night, M: music on / off (keys only - no on-screen UI)
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'KeyN') daynight.toggle();
    else if (e.code === 'KeyV' && !game.modal()) views.next();
    else if (e.code === 'KeyM') music.toggle();
  });

  // The tiles cast shadows through BatchedMeshes, everything else through plain meshes.
  // three uses ONE internal depth material for all shadow casters and re-derives its whole program-parameter
  // set whenever the object class flips (batched <-> plain) - twice per frame, ~6 kB of garbage each frame.
  // A second, identical depth material for the plain meshes removes the flip.
  const plainDepth = new THREE.MeshDepthMaterial();
  scene.traverse((o) => { if (o.isMesh && !o.isBatchedMesh && !o.isInstancedMesh && o.castShadow && !o.customDepthMaterial) o.customDepthMaterial = plainDepth; });

  // ---- one simulation tick (order is part of the contract) ------------------------------------
  const idle = { x: 0, z: 0 };
  const _right = new THREE.Vector3();

  function update(dt) {
    state.time = loop.time;
    state.frame = loop.frame;
    const input = controls.getInput(dt) || idle;
    traveller.update(dt, game.modal() ? idle : input); // No walking while the atlas page is open.
    const p = traveller.position;
    const t = state.traveller;
    t.x = p.x; t.y = p.y; t.z = p.z;
    t.dirX = traveller.moveDir.x; t.dirZ = traveller.moveDir.z; t.speed = traveller.speed;
    _right.setFromMatrixColumn(follow.camera.matrixWorld, 0);
    const rl = hypot2(_right.x, _right.z) || 1;
    state.listener.x = p.x; state.listener.z = p.z;
    state.listener.rightX = _right.x / rl; state.listener.rightZ = _right.z / rl;
    world.update(dt, p, traveller.moveDir);
    if (domes) domes.showAll = introOn || follow.zoom > (domes.showAll ? 1.8 : 2.2); // zoomed-out overview stands every dome up
    if (domes) domes.update(dt, p);
    if (interiors) interiors.update(dt, p);
    views.update(dt);
    follow.update(dt, introOn && introLook ? introLook : traveller); // [intro] framed on the domes until the first input
    daynight.update(dt);
    if (life) life.update(dt, p, follow.camera);
    if (animals) animals.update(dt);
    game.update(dt);
    lights.update(dt, traveller, follow.camera);
    materials.update(dt);
  }

  function render(dt) {
    post.setFocus(follow.focusPoint);
    post.render(dt);
    if (autoQ) autoQ.sample();
    game.atlasmap.render(); // Drawn over the finished frame; no-op while closed.
  }

  const loop = createLoop({ update, render });

  // ---- resize -----------------------------------------------------------------------------------
  function resize() {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    setRendererSize(w, h);
    follow.setAspect(w / h);
    post.setSize(w, h);
    bus.emit('resize', { width: w, height: h, dpr: renderer.getPixelRatio() });
  }
  window.addEventListener('resize', resize);
  // no ?quality= chosen: start at the default and step down to low once if the device is slow
  const autoQ = params.get('quality') ? null : createAutoQuality({ start: quality, setQuality: setRendererQuality, onChange: (lvl) => { state.quality = lvl; post.setQuality(lvl); lights.setQuality(lvl); materials.setQuality(lvl); resize(); } }); // [perf] all four follow the step-down (was: pixel ratio only)

  // ---- hint (the only on-screen text) -----------------------------------------------------------
  if (showHint) {
    if (matchMedia("(pointer: coarse)").matches) hint.textContent = "Tap to walk \u00b7 Pinch zoom \u00b7 2-finger tap: dusk / night \u00b7 3: view \u00b7 4: music"; // [phone] touch-first device
    if (intro) {
      const introEl = document.getElementById('intro');
      introEl.classList.add('on');
      bus.once('input:first', () => {
        introOn = false; introEl.classList.remove('on'); follow.resetZoom();
        queueMicrotask(() => controls.clearTarget()); // the starting tap lands on the far-off map view: it starts, it does not walk
        if (introDusk) daynight.set('day');
        // [hint] the controls line follows the intro instead of sharing its screen: the starting tap would wipe it unread
        hint.classList.add('on');
        setTimeout(() => hint.classList.remove('on'), HINT_HOLD_MS);
      });
    } else {
      hint.classList.add('on');
      bus.once('input:first', () => hint.classList.remove('on'));
    }
  } else hint.remove();

  // Find a safe initial position without skipping the opening fold animation.
  function initialPosition() {
    const x = wfc.start.x * TILE_SIZE; const z = wfc.start.z * TILE_SIZE; // the plaza below the arches
    if (world.isWalkable(x, z)) return [x, z];
    for (let r = 0.25; r <= TILE_SIZE * 3; r += 0.25) {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const nx = x + Math.cos(a) * r;
        const nz = z + Math.sin(a) * r;
        if (world.isWalkable(nx, nz)) return [nx, nz];
      }
    }
    return [x, z];
  }

  // ---- start ------------------------------------------------------------------------------------------
  if (animals) await animals.ready;
  resize();
  const [x, z] = initialPosition();
  traveller.teleport(x, z);
  controls.clearTarget();
  update(0);
  // [intro] start on the whole book, framed between the traveller and the domes; the camera glides to him on the first input
  introLook = intro && domes ? { position: new THREE.Vector3(), velocity: new THREE.Vector3() } : null;
  if (introLook) {
    const n = domes.domes.length; const cx = domes.domes.reduce((a, d) => a + d.x, 0) / n; const cz = domes.domes.reduce((a, d) => a + d.z, 0) / n;
    introLook.position.set(x + (cx - x) * INTRO_TOWARD_DOMES, 0, z + (cz - z) * INTRO_TOWARD_DOMES);
  }
  if (intro) follow.setZoom(Infinity);
  follow.snap(introLook || traveller);
  _right.setFromMatrixColumn(follow.camera.matrixWorld, 0);
  const rl = hypot2(_right.x, _right.z) || 1;
  state.listener.rightX = _right.x / rl; state.listener.rightZ = _right.z / rl;
  if (world.faceCamera) world.faceCamera();
  if (life) life.update(0, traveller.position, follow.camera);
  lights.update(0, traveller, follow.camera);
  render(0);
  loop.start();
}

boot().catch((err) => {
  console.error('[atlas] boot failed', err);
  throw err;
});

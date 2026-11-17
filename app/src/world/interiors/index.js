// Dome interiors (wave3-H): each dome's planting as hinged, printed cardstock cards (fold.js) that pop up when the
// dome's cutaway opens (the traveller is inside, domes.js `inside` / `override.cut`) and fold flat when they leave.
//
// Same set-piece idea as world/domes.js and world/site/ (ARCHITECTURE.md §5.4 option A): one fold instance per dome,
// outside the tile streamer. Cards: site/card.js spriteCard (ARCHITECTURE.md §4.B, art from the papertrails atlas plus
// the `int_*` sprites packed by tools/art/pack_interiors.py). Every card of all three domes is ONE instance of ONE
// BatchedMesh on the shared paper material, so an open interior costs one draw call (+ shadow); folded interiors are
// hidden (zero). The printed floors (paths, ponds, beds) are one more mesh, always on the page.
// Hook (main.js): createInteriors({ scene, materials, domes, daynight }) after createDomes, update(dt) after domes.update.
import * as THREE from 'three';
import { createFoldInstance } from '../fold.js';
import { spriteCard, flap } from '../site/card.js';
import { BASE_R } from '../domes/shell.js';
import { PLANS, layout, pondsOf } from './plans.js';
import { network, pathDistance, PATH_HALF } from './paths.js';

const STAGGER = 0.9; // s: the planting ripples up from the centre over ~1 s (fold.js per-instance staggerSpan)
const FLOOR_PX = 512; // canvas pixels per dome floor
const CROSS_YAW = 0.7; // rad: crossed tree cards stand on the view diagonals (world.js CROSS_RX does the same)

function hash01(i, k) { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); }

/** Indexed copy (BatchedMesh needs every geometry indexed or none). ExtrudeGeometry is non-indexed. */
function indexed(geo) {
  const n = geo.getAttribute('position').count;
  geo.setIndex(Array.from({ length: n }, (_, i) => i));
  return geo;
}

/** One dome's card tree: Group (dome-local) of top-level flaps, each holding one anchor mesh (userData.card = key). */
function buildPlanting(id, atlas, paper) {
  const root = new THREE.Group();
  root.name = 'interior_' + id;
  const cards = layout(id, atlas);
  for (const c of cards) {
    const sprite = atlas.sprites[c.s];
    const back = c.z < 0; // fold toward the centre: back cards fall forward (+Z), front cards fall back (-Z)
    const delay = Math.min(1, (Math.hypot(c.x, c.z) / BASE_R) * 0.75 + hash01(c.i, 1) * 0.25);
    const yaw = (hash01(c.i, 2) - 0.5) * 0.5; // facing the follow camera (+Z), hand-placed jitter
    const lean = (hash01(c.i, 3) - 0.5) * 0.04;
    const planes = c.cross ? [yaw - CROSS_YAW, yaw + CROSS_YAW] : [yaw];
    planes.forEach((py, k) => {
      const name = `${id}_${c.s}_${c.i}_${k}`;
      const mesh = spriteCard(name, sprite, atlas.size, c.h, paper);
      indexed(mesh.geometry);
      mesh.userData.card = name;
      root.add(flap(name, mesh, { x: c.x, z: c.z, yaw: py, layer: (c.i * 2 + k) % 10, delay, sign: back ? 1 : -1, lean, stiffness: c.h > 2 ? 0.7 : 1 }));
    });
  }
  return { root, cards };
}

// ---- printed floors -------------------------------------------------------------------------------------------------
function drawFloor(ctx, ox, id, cards) {
  const f = PLANS[id].floor; const S = FLOOR_PX / (2 * BASE_R); const c0 = FLOOR_PX / 2;
  const P = (x, z) => [ox + c0 + x * S, c0 + z * S];
  ctx.save();
  ctx.beginPath(); ctx.arc(ox + c0, c0, c0 - 1, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = f.ground; ctx.fillRect(ox, 0, FLOOR_PX, FLOOR_PX);
  // grain / leaf litter: deterministic speckles
  const specks = f.litter || [f.grain];
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = specks[i % specks.length];
    ctx.globalAlpha = 0.35 + hash01(i, 7) * 0.3;
    ctx.fillRect(ox + hash01(i, 5) * FLOOR_PX, hash01(i, 6) * FLOOR_PX, 2 + hash01(i, 8) * 3, 2);
  }
  ctx.globalAlpha = 1;
  // wave6-Q ground cover: printed leaf / gravel mats over every bit of floor off the walks (judges: no bare floor)
  if (f.cover) {
    const net0 = network(id);
    for (let i = 0; i < 1400; i++) {
      const a = hash01(i, 21) * Math.PI * 2; const r = Math.sqrt(hash01(i, 22)) * BASE_R * 0.97;
      const x = Math.cos(a) * r; const z = Math.sin(a) * r;
      if (pathDistance(net0, x, z) < PATH_HALF + 0.08) continue;
      const [px, py] = P(x, z); const w = (0.12 + hash01(i, 23) * 0.22) * S;
      ctx.fillStyle = f.cover[i % f.cover.length]; ctx.globalAlpha = 0.55 + hash01(i, 24) * 0.35;
      ctx.beginPath(); ctx.ellipse(px, py, w, w * 0.7, hash01(i, 25) * 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // planting beds under the cards (soft darker patches), rock bases in the desert, coloured beds in the show
  cards.forEach((c, i) => {
    const [x, y] = P(c.x, c.z);
    const w = Math.min(1.2, c.h * 0.45) * S;
    const bed = f.beds && /flower_bed|drift|coleus/.test(c.s);
    ctx.fillStyle = bed ? f.beds[i % f.beds.length] : (f.rocks && /red_|sand_/.test(c.s) ? f.rocks : f.grain);
    ctx.globalAlpha = bed ? 0.85 : 0.55;
    ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.6, 0, 0, Math.PI * 2); ctx.fill();
  });
  ctx.globalAlpha = 1;
  // walks: the traced plan paths (paths.js, plan 01) + a spur from every doorway, edged like the site walks
  const net = network(id);
  const stroke = (color, width) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const line of [...net.polys, ...net.spurs]) {
      ctx.beginPath();
      line.forEach(([x, z], i) => { const [px, py] = P(x, z); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
      ctx.stroke();
    }
  };
  stroke(f.pathEdge, PATH_HALF * 2 * S + 5);
  stroke(f.path, PATH_HALF * 2 * S);
  // ponds (desert: photo 29; show: photo 28)
  for (const p of pondsOf(id)) {
    const [x, y] = P(p.x, p.z);
    ctx.fillStyle = p.rim; ctx.beginPath(); ctx.arc(x, y, p.rad * S + 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.water; ctx.beginPath(); ctx.arc(x, y, p.rad * S, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(x - p.rad * S * 0.25, y - p.rad * S * 0.3, p.rad * S * 0.45, p.rad * S * 0.15, -0.4, 0, Math.PI * 2); ctx.fill();
    if (p.lilies) {
      for (let i = 0; i < 9; i++) {
        const a = hash01(i, 11) * Math.PI * 2; const r = Math.sqrt(hash01(i, 12)) * p.rad * S * 0.8;
        ctx.fillStyle = i % 3 ? '#4f8a4a' : '#e9a2b6';
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, i % 3 ? 7 : 4, 0.3, Math.PI * 2 - 0.3); ctx.fill();
      }
    }
  }
  ctx.restore();
}

function buildFloors(ids, layouts) {
  const canvas = document.createElement('canvas');
  canvas.width = FLOOR_PX * ids.length; canvas.height = FLOOR_PX;
  const ctx = canvas.getContext('2d');
  ids.forEach((id, k) => drawFloor(ctx, k * FLOOR_PX, id, layouts[k]));
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return map;
}

// ---- assembly -----------------------------------------------------------------------------------------------------
export async function createInteriors({ scene, materials, domes, daynight }) {
  const atlas = await fetch('./textures/art/atlas.json').then((r) => (r.ok ? r.json() : Promise.reject(new Error('atlas.json HTTP ' + r.status))));
  const paper = materials.paper({ color: '#ffffff', side: THREE.DoubleSide, variant: 'interior' });
  const ids = domes.domes.map((d) => d.id);

  const rooms = domes.domes.map((d) => {
    const { root, cards } = buildPlanting(d.id, atlas, paper);
    root.position.set(d.x, 0, d.z);
    root.updateMatrixWorld(true);
    const anchors = [];
    root.traverse((o) => { if (o.userData.card) anchors.push(o); });
    return { dome: d, id: d.id, root, cards, anchors, ids: [], fold: createFoldInstance(root, { tileId: 'interior:' + d.id, staggerSpan: STAGGER }), shown: false };
  });

  // one BatchedMesh for every card of every interior
  const geos = rooms.flatMap((r) => r.anchors.map((a) => a.geometry));
  const verts = geos.reduce((n, g) => n + g.getAttribute('position').count, 0);
  const batch = new THREE.BatchedMesh(geos.length, verts, verts, paper);
  batch.name = 'dome-interiors';
  batch.castShadow = true; batch.receiveShadow = true;
  batch.frustumCulled = false; // bounds change as the cards fold; per-instance culling instead
  batch.perObjectFrustumCulled = true;
  for (const r of rooms) for (const a of r.anchors) { r.ids.push(batch.addInstance(batch.addGeometry(a.geometry))); a.geometry.dispose(); }
  for (const r of rooms) for (const i of r.ids) batch.setVisibleAt(i, false);
  batch.visible = false;
  scene.add(batch);

  // printed floors: one mesh, three discs on one canvas
  const floorMap = buildFloors(ids, rooms.map((r) => r.cards));
  const discs = rooms.map((r, k) => {
    const g = new THREE.CircleGeometry(BASE_R, 64);
    const uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setX(i, (k + uv.getX(i)) / rooms.length);
    g.rotateX(-Math.PI / 2);
    g.translate(r.dome.x, 0.002, r.dome.z);
    return g;
  });
  const { mergeGeometries } = await import('three/examples/jsm/utils/BufferGeometryUtils.js');
  const floor = new THREE.Mesh(mergeGeometries(discs), new THREE.MeshLambertMaterial({ map: floorMap, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  floor.name = 'dome-floors';
  floor.receiveShadow = true;
  for (const g of discs) g.dispose();
  scene.add(floor);

  function write(r) {
    r.root.updateMatrixWorld(true);
    for (let i = 0; i < r.ids.length; i++) batch.setMatrixAt(r.ids[i], r.anchors[i].matrixWorld);
  }
  function show(r, on) {
    if (r.shown === on) return;
    r.shown = on;
    for (const i of r.ids) batch.setVisibleAt(i, on);
    batch.visible = rooms.some((k) => k.shown);
  }
  for (const r of rooms) write(r);

  const api = {
    rooms, batch, floor,
    /** Per frame, after domes.update(): open = the dome stands and its cutaway is open. */
    update(dt) {
      const cut = domes.override.cut;
      for (const r of rooms) {
        const d = r.dome;
        const open = d.want === 1 && (cut !== null ? !!cut : d.inside);
        if (open && r.fold.target !== 1) { show(r, true); r.fold.setTarget(1); }
        else if (!open && r.fold.target !== 0) r.fold.setTarget(0);
        if (!r.fold.settled) { r.fold.update(dt); write(r); }
        else if (r.fold.target === 0) show(r, false);
      }
    },
    /** Evidence: what each interior holds. */
    debugProps() { return rooms.map((r) => ({ id: r.id, open: r.fold.target === 1, cards: r.anchors.length, props: r.cards.map((c) => c.s) })); },
  };
  if (new URLSearchParams(location.search).get('debug') === '1') window.__interiors = { ...api, daynight };
  return api;
}

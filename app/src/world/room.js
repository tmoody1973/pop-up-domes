// [wave4-I] The room around the book: a finite walnut tabletop (papertrails' table_wood.jpg), a dim room (ONE inward
// box: plaster walls with a dark wainscot, floorboards, ceiling) and a brass lantern prop on the table.
// Why: the low dome-approach lens looked past the page edge at the bare backdrop: post.js fades sky pixels with a
// position rebuilt at the far plane, which split it into a two-tone vertical seam, and the old 260-unit table plane was
// cut by the camera far plane (120) into a hard horizon band. Now every ray ends on geometry inside the far plane.
// No lights are added: the scene's rig lights the room. The lantern glows through an emissive glass material, which
// render/daynight.js picks up into its glow list (3 by day .. 9 at night, like the dome halos); the warm pool it throws
// on the table and walls is painted in the room shaders from the same number.
// Scale: the book is ~48 x 32 units, so 1 unit reads as ~1 cm at table scale (table ~78 x 58, floor 62 below).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const ROOM = {
  tableMargin: [14, 12], // tabletop beyond the cover board (x, z)
  tableThick: 3,
  half: [56, 50], // walls from the book centre (x, z): the far corner stays inside camera.far (120) from any play pose
  floorDrop: 62, // floor below the tabletop
  height: 70, // ceiling above the tabletop
  falloff: [18, 60], // world units from the book centre: full light -> dim room
  lanternScale: 1.4, // ~13 units tall: about a third of the book's depth, as in concept frame 01
  lamp: { color: [1.0, 0.62, 0.3], radius: 16, gain: 7 },
};

// Shared by the table and the room box: warm painted pool of the lantern + darkening away from the book.
const ROOM_PARS = /* glsl */ `
varying vec3 vRoomW;
uniform vec4 uLamp;   // xyz lantern glass centre (world), w = glow 0..1 (daynight glow intensity / 9)
uniform vec4 uRoom;   // xy book centre (world xz), z / w = falloff start / end
float roomDim(vec3 wp) { return mix(1.0, 0.32, smoothstep(uRoom.z, uRoom.w, distance(wp.xz, uRoom.xy))); }
vec3 lampPool(vec3 albedo, vec3 wp) {
  float d = distance(wp, uLamp.xyz);
  return albedo * vec3(${ROOM.lamp.color.join(', ')}) * uLamp.w * ${ROOM.lamp.gain.toFixed(1)} * exp(-d * d / ${(ROOM.lamp.radius ** 2).toFixed(1)});
}
`;

function roomMaterial(key, uniforms, colourGLSL, opts = {}) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: opts.roughness ?? 0.85, metalness: 0, side: opts.side ?? THREE.FrontSide });
  m.name = 'room:' + key;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRoomW;\nvarying vec3 vRoomL;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRoomL = position;\nvRoomW = (modelMatrix * vec4(position, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRoomL;\nuniform sampler2D uWood;\nuniform vec4 uWoodK;\n' + ROOM_PARS + (opts.pars || ''))
      .replace('#include <map_fragment>', '#include <map_fragment>\n{\n' + colourGLSL + '\n}')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += lampPool(diffuseColor.rgb, vRoomW);');
  };
  m.customProgramCacheKey = () => 'room-' + key + '-v1';
  return m;
}

/** Brass lantern (~9.7 units tall before ROOM.lanternScale, octagonal): brass body + one emissive frosted glass chimney. 2 draw calls. */
function buildLantern() {
  const brassParts = [
    new THREE.CylinderGeometry(2.3, 2.5, 0.5, 8).translate(0, 0.25, 0), // foot
    new THREE.CylinderGeometry(1.95, 2.1, 0.9, 8).translate(0, 0.95, 0), // fuel drum
    new THREE.CylinderGeometry(2.0, 1.95, 0.5, 8).translate(0, 6.25, 0), // top band
    new THREE.ConeGeometry(2.25, 1.7, 8).translate(0, 7.35, 0), // roof
    new THREE.CylinderGeometry(0.35, 0.5, 0.6, 8).translate(0, 8.4, 0), // vent
    new THREE.TorusGeometry(1.15, 0.13, 6, 20).translate(0, 9.6, 0), // carry ring
  ];
  for (let k = 0; k < 8; k++) { // cage posts on the octagon corners
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    brassParts.push(new THREE.BoxGeometry(0.2, 4.6, 0.2).translate(Math.sin(a) * 1.9, 3.7, Math.cos(a) * 1.9));
  }
  const brass = new THREE.Mesh(mergeGeometries(brassParts, false),
    new THREE.MeshStandardMaterial({ color: '#a27a3e', roughness: 0.42, metalness: 0.35, name: 'room:brass' }));
  for (const g of brassParts) g.dispose();
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 4.6, 8).translate(0, 3.7, 0),
    // dim emissive colour: daynight multiplies it by the glow intensity (same convention as the dome halos)
    new THREE.MeshStandardMaterial({ color: '#f1d6a2', roughness: 0.35, metalness: 0, emissive: '#8a4e16', emissiveIntensity: 3, name: 'room:lantern-glass' }));
  const g = new THREE.Group();
  g.name = 'lantern';
  for (const m of [brass, glass]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
  return { group: g, glass };
}

/**
 * @param {object} o
 * @param {THREE.Scene} o.scene
 * @param {THREE.Texture} o.wood   table albedo (sRGB, repeat-wrapped)
 * @param {number} o.woodScale     world units per wood repeat
 * @param {number} o.woodGain      albedo multiplier
 * @param {{x:number,z:number,cw:number,cd:number}} o.book  book centre and cover half extents (world)
 * @param {number} o.tableY        tabletop height (just under the cover board)
 */
export function createRoom({ scene, wood, woodScale, woodGain = 1, book, tableY }) {
  const uniforms = {
    uWood: { value: wood },
    uWoodK: { value: new THREE.Vector4(1 / woodScale, woodGain, 0, 0) },
    uLamp: { value: new THREE.Vector4(0, 0, 0, 0) },
    uRoom: { value: new THREE.Vector4(book.x, book.z, ROOM.falloff[0], ROOM.falloff[1]) },
    uBookRect: { value: new THREE.Vector4(book.x, book.z, book.cw, book.cd) },
  };
  const group = new THREE.Group();
  group.name = 'room';

  // ---- tabletop (the top face is what the book lies on; the sides show the board's thickness) ----
  const tw = book.cw + ROOM.tableMargin[0]; const td = book.cd + ROOM.tableMargin[1];
  const tableMat = roomMaterial('table', uniforms, /* glsl */ `
    diffuseColor.rgb = texture2D(uWood, vRoomW.xz * uWoodK.x).rgb * uWoodK.y;
    vec2 bd = abs(vRoomW.xz - uBookRect.xy) - uBookRect.zw;
    float dist = length(max(bd, 0.0)) + min(max(bd.x, bd.y), 0.0);
    diffuseColor.rgb *= mix(0.3, 1.0, smoothstep(0.0, 1.5, dist));   // contact occlusion around the book
    diffuseColor.rgb *= vRoomL.y > ${(ROOM.tableThick / 2 - 0.01).toFixed(2)} ? roomDim(vRoomW) : 0.45 * roomDim(vRoomW); // the edge sits in shade`,
  { pars: 'uniform vec4 uBookRect;', roughness: 0.78 });
  const table = new THREE.Mesh(new THREE.BoxGeometry(tw * 2, ROOM.tableThick, td * 2), tableMat);
  table.name = 'table';
  table.position.set(book.x, tableY - ROOM.tableThick / 2, book.z);
  table.receiveShadow = true;
  group.add(table);

  // ---- room: one inward box (walls, floorboards, ceiling) ----
  const [rx, rz] = ROOM.half;
  const rh = ROOM.floorDrop + ROOM.height;
  const roomMat = roomMaterial('room', uniforms, /* glsl */ `
    float h = vRoomL.y + ${(rh / 2).toFixed(1)};   // height above the floor
    vec3 c;
    if (h < 0.05) c = texture2D(uWood, vRoomW.zx * uWoodK.x * 0.35).rgb * 0.55;   // floorboards, grain across the room
    else if (h > ${(rh - 0.05).toFixed(1)}) c = vec3(0.012, 0.009, 0.007);       // ceiling
    else {
      vec3 plaster = vec3(0.075, 0.05, 0.033) * (0.92 + 0.08 * sin(vRoomW.x * 0.37 + vRoomW.z * 0.29 + h * 0.11));
      vec3 panel = texture2D(uWood, vec2(vRoomW.x + vRoomW.z, h) * uWoodK.x * 0.5).rgb * 0.6;
      float rail = smoothstep(37.0, 37.4, h) * (1.0 - smoothstep(38.6, 39.0, h));
      c = h < 37.0 ? panel : mix(plaster, vec3(0.16, 0.1, 0.055), rail);
      c *= 0.55 + 0.45 * smoothstep(0.0, 6.0, h);   // skirting shade at the floor
    }
    diffuseColor.rgb = c * roomDim(vRoomW);`, { side: THREE.BackSide, roughness: 0.92 });
  const room = new THREE.Mesh(new THREE.BoxGeometry(rx * 2, rh, rz * 2), roomMat);
  room.name = 'room-box';
  room.position.set(book.x, tableY - ROOM.floorDrop + rh / 2, book.z);
  group.add(room);

  // ---- lantern: back-left of the book on the table (concept frame 01) ----
  const lantern = buildLantern();
  lantern.group.position.set(book.x - book.cw * 0.5, tableY, book.z - book.cd - 4.5);
  lantern.group.rotation.y = 0.3;
  lantern.group.scale.setScalar(ROOM.lanternScale);
  group.add(lantern.group);
  uniforms.uLamp.value.set(lantern.group.position.x, tableY + 3.7 * ROOM.lanternScale, lantern.group.position.z, 0);

  for (const o of [table, room]) o.frustumCulled = false;
  scene.add(group);

  return {
    group,
    table,
    lantern: lantern.group,
    /** Follow the glow the day/night cycle sets on the lantern glass (3 by day .. 9 at night). */
    update() { uniforms.uLamp.value.w = Math.min(1, lantern.glass.material.emissiveIntensity / 9); },
    dispose() {
      scene.remove(group);
      group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    },
  };
}

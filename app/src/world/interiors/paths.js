// Interior walks of the three domes, traced from the floor plan (wave3-H). Pure data + helpers (Node-testable).
//
// Source: Mitchell-Park-Domes-Reference/03-floor-plans/01_existing-first-floor-plan.jpg (same plan as 06, labelled).
// Each dome was cropped at its glass ring and the walk's CENTRELINE read off on a normalised grid:
//   frame: dome centre = (0, 0), glass foot = radius 1, u = east, v = NORTH (plan north is up; no rotation needed:
//   the plan's door bearings match the doorways below within ~10 deg). To world: x = u * BASE_R, z = -v * BASE_R.
//   Show (NW on the plan): a loop round a central pond / bed, a spur in from the west loop to the gazebo platform.
//   Desert (NE): a serpentine that winds in from the west door round the north and east, then spirals into the centre
//   (the rock island); a branch drops to the south door.
//   Tropical (S): a tight zigzag from the NW door down the west side and back up through the middle, a lobe on the
//   east side, and a branch to the north door.
// Doorways (cut in the ring by the collision wave): angle = atan2(dz, dx) in world units, +z = south. The plan's door
// positions differ slightly; the doorways win and a spur joins each to the nearest point of the traced walk.
import { BASE_R } from '../domes/shell.js';

export const PATH_HALF = 3.5 / 12; // 7-ft walk (units), half width
export const DOORS_DEG = { show: [43, 0], desert: [137, 180, 90], tropical: [-137, -90] };

/** Traced centrelines, [u, v] (v = north). Branches start on a vertex of an earlier polyline. */
export const TRACE = {
  show: [
    // the loop (closed)
    [[0.62, 0.05], [0.55, 0.33], [0.35, 0.55], [0.05, 0.63], [-0.28, 0.57], [-0.52, 0.38], [-0.63, 0.08], [-0.58, -0.22],
      [-0.4, -0.47], [-0.12, -0.62], [0.18, -0.6], [0.43, -0.45], [0.58, -0.22], [0.62, 0.05]],
    // west spur to the gazebo platform (plan: the straight line in from the NW of the loop)
    [[-0.52, 0.38], [-0.3, 0.37], [-0.08, 0.33]],
  ],
  desert: [
    [[-0.82, 0.08], [-0.62, 0.22], [-0.42, 0.42], [-0.15, 0.56], [0.15, 0.6], [0.42, 0.5], [0.58, 0.28], [0.62, 0.0],
      [0.52, -0.25], [0.32, -0.42], [0.05, -0.47], [-0.2, -0.38], [-0.36, -0.15], [-0.34, 0.1], [-0.18, 0.28],
      [0.05, 0.32], [0.24, 0.18], [0.28, -0.02], [0.16, -0.18]],
    [[0.32, -0.42], [0.3, -0.62], [0.12, -0.8]], // branch to the south door
  ],
  tropical: [
    [[-0.55, 0.62], [-0.5, 0.4], [-0.62, 0.18], [-0.66, -0.1], [-0.55, -0.38], [-0.35, -0.55], [-0.18, -0.4],
      [-0.2, -0.15], [-0.08, 0.1], [0.1, 0.3], [0.3, 0.38], [0.42, 0.2], [0.3, -0.02], [0.18, -0.25], [0.25, -0.5],
      [0.1, -0.7]],
    [[0.25, -0.5], [0.5, -0.45], [0.62, -0.2], [0.55, 0.05], [0.42, 0.2]], // east lobe
    [[0.3, 0.38], [0.25, 0.58], [0.12, 0.78]], // branch toward the north door
  ],
};

/** Catmull-Rom densify (uniform), keeps the end points and every traced vertex. */
function densify(pts, n = 6) {
  const out = [];
  const closed = pts.length > 2 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1];
  const P = (i) => (closed ? pts[(i + pts.length - 1) % (pts.length - 1)] : pts[Math.max(0, Math.min(pts.length - 1, i))]);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = closed && i === 0 ? pts[pts.length - 2] : P(i - 1); const p1 = pts[i]; const p2 = pts[i + 1];
    const p3 = closed && i === pts.length - 2 ? pts[1] : P(i + 2);
    for (let k = 0; k < n; k++) {
      const t = k / n; const t2 = t * t; const t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function nearestOn(polys, [x, y]) {
  let best = null; let bd = Infinity;
  for (const p of polys) {
    for (let i = 0; i < p.length - 1; i++) {
      const [ax, ay] = p[i]; const [bx, by] = p[i + 1]; const dx = bx - ax; const dy = by - ay;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
      const q = [ax + t * dx, ay + t * dy]; const d = Math.hypot(x - q[0], y - q[1]);
      if (d < bd) { bd = d; best = q; }
    }
  }
  return { point: best, dist: bd };
}

/**
 * The walk network of a dome in dome-local WORLD units ([x, z], z = south): densified traced polylines + one spur per
 * doorway (rim -> 0.86 r -> nearest point of the trace). { polys, spurs, doors } (doors = rim points).
 */
export function network(id) {
  const trace = TRACE[id].map((p) => densify(p));
  const doors = DOORS_DEG[id].map((deg) => [Math.cos((deg * Math.PI) / 180), -Math.sin((deg * Math.PI) / 180)]); // (u, v)
  const spurs = doors.map(([u, v]) => {
    const mid = [u * 0.86, v * 0.86];
    return [[u * 1.04, v * 1.04], mid, nearestOn(trace, mid).point];
  });
  const W = ([u, v]) => [u * BASE_R, -v * BASE_R];
  return { polys: trace.map((p) => p.map(W)), spurs: spurs.map((p) => p.map(W)), doors: doors.map(W), trace };
}

/** Distance (units) from dome-local (x, z) to the nearest walk centreline. */
export function pathDistance(net, x, z) {
  return nearestOn([...net.polys, ...net.spurs], [x, z]).dist;
}

/** Connectivity check: union-find over polylines that touch (an end within `tol` of another polyline). Returns one
 *  row per doorway: { deg, component, connected } where connected = the door's spur is in the same component as
 *  every other door. */
export function doorConnectivity(id, tol = 0.02) {
  const net = network(id);
  const all = [...net.polys, ...net.spurs];
  const parent = all.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < all.length; i++) {
    for (let j = 0; j < all.length; j++) {
      if (i === j) continue;
      const ends = [all[i][0], all[i][all[i].length - 1]];
      if (ends.some((e) => nearestOn([all[j]], e).dist < tol)) parent[find(i)] = find(j);
    }
  }
  const comps = net.spurs.map((_, k) => find(net.polys.length + k));
  return DOORS_DEG[id].map((deg, k) => ({ deg, component: comps[k], connected: comps.every((c) => c === comps[k]),
    rimRadius: +Math.hypot(...net.spurs[k][0]).toFixed(2) }));
}

# [wave5-L] Fidelity (c): measure plan 03-floor-plans/06 and compare with SITE (app/src/world/sitemap.js).
# Scale: mean fitted dome diameter = 140 ft (BUILD-NOTES §1). Origin: fitted Show Dome centre. North = image up
# (north arrow is vertical). Dome outlines are least-squares circle fits to the outer edge of the green fill along
# rays that end in white paper (rays into the lobby / links / additions are dropped). Feature points (lobby hub, link
# galleries, arcade front, pools) are picked by eye on full-res crops (overlay saved) - +-10 px (~3 ft) reading error.
import json, math, sys
import numpy as np
from PIL import Image, ImageDraw
REPO = '/Users/tarikmoody/Projects/domes'
im = Image.open(REPO + '/Mitchell-Park-Domes-Reference/03-floor-plans/06_nrhp-boundary-site-plan.jpg').convert('RGB')
A = np.asarray(im).astype(int); Hh, Ww, _ = A.shape
K = 3154 / 2000  # rough guesses below were read at 2000 px wide
rough = {'show': (694, 602, 146), 'desert': (1040, 620, 142), 'tropical': (1050, 962, 146)}
def green(p): r, g, b = p; return g > r + 35 and g > b + 5
def white(p): return min(p) > 215
def fit(cx, cy, R):
  pts = []
  for k in range(720):
    a = 2 * math.pi * k / 720; ca, sa = math.cos(a), math.sin(a)
    ox, oy = int(cx + 1.25 * R * ca), int(cy + 1.25 * R * sa)
    if not (0 <= ox < Ww and 0 <= oy < Hh): continue
    # outside must be paper (white) over 1.12R..1.25R, else the ray runs into a building
    if not all(white(A[int(cy + t * R * sa), int(cx + t * R * ca)]) or not green(A[int(cy + t * R * sa), int(cx + t * R * ca)]) and min(A[int(cy + t * R * sa), int(cx + t * R * ca)]) > 150 for t in np.linspace(1.12, 1.25, 8)): continue
    last = None
    for t in np.linspace(0.8, 1.15, 300):
      x, y = int(cx + t * R * ca), int(cy + t * R * sa)
      p = A[y, x]
      if green(p) or max(p) < 110: last = (cx + t * R * ca, cy + t * R * sa)
    if last: pts.append(last)
  P = np.array(pts)
  for _ in range(3):  # algebraic circle fit + outlier trim
    M = np.c_[2 * P[:, 0], 2 * P[:, 1], np.ones(len(P))]; bb = (P ** 2).sum(1)
    x0, y0, c = np.linalg.lstsq(M, bb, rcond=None)[0]; r = math.sqrt(c + x0 ** 2 + y0 ** 2)
    res = np.abs(np.hypot(P[:, 0] - x0, P[:, 1] - y0) - r); P = P[res < max(3, 2.5 * np.median(res))]
  return x0, y0, r, len(P), float(np.median(res))
fits = {k: fit(x * K, y * K, R * K) for k, (x, y, R) in rough.items()}
# Desert: most of its rim is buried in the lobby / ED-centre additions (few white-paper rays), so its free fit runs
# large. Scale comes from Show + Tropical (clean rims); Desert's centre is refit with that radius held.
D = np.mean([2 * fits[k][2] for k in ('show', 'tropical')]); pxft = D / 140
_d = fits['desert']
# re-collect desert edge points and solve centre with r fixed (Gauss-Newton)
def edge_pts(cx, cy, R):
  pts = []
  for k in range(720):
    a = 2 * math.pi * k / 720; ca, sa = math.cos(a), math.sin(a)
    try: ok = all(min(A[int(cy + t * R * sa), int(cx + t * R * ca)]) > 150 and not green(A[int(cy + t * R * sa), int(cx + t * R * ca)]) for t in np.linspace(1.12, 1.25, 8))
    except IndexError: ok = False
    if not ok: continue
    last = None
    for t in np.linspace(0.8, 1.15, 300):
      x, y = int(cx + t * R * ca), int(cy + t * R * sa); q = A[y, x]
      if green(q) or max(q) < 110: last = (cx + t * R * ca, cy + t * R * sa)
    if last: pts.append(last)
  return np.array(pts)
P = edge_pts(rough['desert'][0] * K, rough['desert'][1] * K, rough['desert'][2] * K); r = D / 2
c = np.array([_d[0], _d[1]])
for _ in range(50):
  dv = P - c; dist = np.hypot(dv[:, 0], dv[:, 1]); res = dist - r
  J = -dv / dist[:, None]; c = c - np.linalg.lstsq(J, res, rcond=None)[0]
fits['desert'] = (c[0], c[1], r, len(P), float(np.median(np.abs(res))))
ox, oy = fits['show'][0], fits['show'][1]
ft = lambda x, y: ((x - ox) / pxft, -(y - oy) / pxft)
out = {'px_per_ft': round(pxft, 3), 'dome_diam_px': {k: round(2 * f[2], 1) for k, f in fits.items()}, 'fit_points': {k: f[3] for k, f in fits.items()},
       'fit_median_resid_px': {k: round(f[4], 2) for k, f in fits.items()}}
SITE = {'show': (0, 0), 'desert': (169, 0), 'tropical': (169, -158)}
rows = []
for k, f in fits.items():
  p = ft(f[0], f[1]); rows.append(('dome centre ' + k, p, SITE[k]))
# Feature picks (full-res px), read on the crops in plan06-overlay.jpg:
picks = json.load(open(sys.argv[1])) if len(sys.argv) > 1 else {}
SITEF = {  # from app/src/world/sitemap.js SITE (ft)
  'lobby hub centre': (84.5, -79),
  'link Show-Desert (midpoint)': (84.5, 0),
  'link Desert-Tropical (midpoint)': (169, -79),
  'arcade front (centre)': (51.95, -111.55),
  'pool W (centre)': (6.7, -121), 'pool E (centre)': (42, -156.3),
}
for name, xy in picks.items():
  if name.startswith('_'): continue
  x, y = xy
  rows.append((name, ft(x, y), SITEF[name]))
# Registered frame: least-squares rigid fit (rotation + translation, scale held at the diameter scale) of the three
# plan dome centres onto the SITE / BUILD-NOTES §4 centres - the frame SITE is drawn in. Reported beside north-up.
Pp = np.array([ft(fits[k][0], fits[k][1]) for k in SITE]); Qq = np.array([SITE[k] for k in SITE], float)
mp, mq = Pp.mean(0), Qq.mean(0); Hm = (Pp - mp).T @ (Qq - mq); U, _, Vt = np.linalg.svd(Hm); Rm = (U @ Vt).T
if np.linalg.det(Rm) < 0: Vt[-1] *= -1; Rm = (U @ Vt).T
th = math.atan2(Rm[1, 0], Rm[0, 0])
rot = lambda p: tuple(Rm @ (np.array(p) - mp) + mq)
out['plan_rotation_vs_site_deg'] = round(math.degrees(th), 2)
print(json.dumps(out))
print(f"{'feature':34s} {'plan ft (N-up)':>18s} {'err':>6s} {'plan ft (reg.)':>18s} {'err':>6s} {'SITE ft':>18s}")
res = []
for name, p, s in rows:
  q = rot(p); e = math.hypot(p[0] - s[0], p[1] - s[1]); e2 = math.hypot(q[0] - s[0], q[1] - s[1])
  res.append({'feature': name, 'plan_ft_north_up': [round(p[0], 1), round(p[1], 1)], 'err_north_up_ft': round(e, 1), 'plan_ft_registered': [round(q[0], 1), round(q[1], 1)], 'err_registered_ft': round(e2, 1), 'site_ft': list(s)})
  print(f"{name:34s} ({p[0]:7.1f},{p[1]:7.1f}) {e:6.1f} ({q[0]:7.1f},{q[1]:7.1f}) {e2:6.1f} ({s[0]:7.1f},{s[1]:7.1f})")
if '_axis' in picks:
  (x0, y0), (x1, y1) = picks['_axis']; a0, a1 = ft(x0, y0), ft(x1, y1)
  brg = math.degrees(math.atan2(a1[0] - a0[0], a1[1] - a0[1])) % 360
  out['arcade_axis_bearing_deg'] = {'plan_north_up': round(brg, 1), 'plan_registered': round((brg - math.degrees(th)) % 360, 1), 'site': 225.0}
  print('arcade axis bearing (arcade -> SW between the pools, compass deg):', out['arcade_axis_bearing_deg'])
print(json.dumps({k: out[k] for k in ('px_per_ft', 'plan_rotation_vs_site_deg')}))
# overlay for the record
ov = im.copy(); d = ImageDraw.Draw(ov)
for k, f in fits.items(): d.ellipse([f[0] - f[2], f[1] - f[2], f[0] + f[2], f[1] + f[2]], outline=(255, 0, 0), width=4)
for name, xy in picks.items():
  if name.startswith('_'): continue
  x, y = xy
  d.ellipse([x - 12, y - 12, x + 12, y + 12], outline=(0, 0, 255), width=5)
for name, p, s in rows[3:]:  # SITE positions back-projected
  X, Y = ox + s[0] * pxft, oy - s[1] * pxft; d.line([X - 14, Y - 14, X + 14, Y + 14], fill=(255, 0, 255), width=5); d.line([X - 14, Y + 14, X + 14, Y - 14], fill=(255, 0, 255), width=5)
ov.crop((700, 550, 2000, 1800)).save(REPO + '/evidence/wave5/fidelity-checks/plan06-overlay.jpg', quality=85)
json.dump({'meta': out, 'rows': res}, open(REPO + '/evidence/wave5/fidelity-checks/plan06.json', 'w'), indent=1)

# wave3-H: draws the traced interior walks (paths.json from paths-check.mjs) over the cropped floor plan 01.
# Red = traced centreline (plan), blue = doorway spurs (doorways from the collision wave), cyan = ponds.
import json, os
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
PLAN = '/Users/tarikmoody/Projects/domes/Mitchell-Park-Domes-Reference/03-floor-plans/01_existing-first-floor-plan.jpg'
# dome centre + glass-ring radius in plan-01 pixels (fitted by eye on the ring, grid crops)
FIT = {'show': (689, 542, 132), 'desert': (1018, 561, 136), 'tropical': (1024, 890, 132)}
data = json.load(open(os.path.join(HERE, 'paths.json')))
im = Image.open(PLAN).convert('RGB')
for id_, (cx, cy, r) in FIT.items():
    m = int(r * 1.15); S = 900 / (2 * m)
    c = im.crop((cx - m, cy - m, cx + m, cy + m)).resize((900, 900), Image.LANCZOS)
    d = ImageDraw.Draw(c)
    P = lambda u, v: (450 + u * r * S, 450 - v * r * S)
    d.ellipse([450 - r * S, 450 - r * S, 450 + r * S, 450 + r * S], outline=(160, 160, 160), width=1)
    for p in data[id_]['ponds']:
        x, y = P(p['u'], p['v']); rr = p['rad'] / 5.425 * r * S
        d.ellipse([x - rr, y - rr, x + rr, y + rr], outline=(0, 170, 200), width=3)
    for line in data[id_]['trace']:
        d.line([P(u, v) for u, v in line], fill=(220, 30, 30), width=4, joint='curve')
    for line in data[id_]['spurs']:
        d.line([P(u, v) for u, v in line], fill=(30, 80, 230), width=4)
        x, y = P(*line[0]); d.ellipse([x - 7, y - 7, x + 7, y + 7], fill=(30, 80, 230))
    d.text((10, 10), f'{id_}: red = traced walk (plan 01), blue = doorway spurs, cyan = ponds', fill=(0, 0, 0))
    c.save(f'/Users/tarikmoody/Projects/domes/evidence/wave3/h-paths-{id_}.png')
    print('wrote', f'h-paths-{id_}.png')

# wave4-K: mean colour of the dome region and the page region, render vs concept frame 01 (sRGB means, dE00).
# Usage: python3 measure.py <render.jpg|png> [concept.png]
import sys
import numpy as np
from PIL import Image
from skimage.color import rgb2lab, deltaE_ciede2000

CONCEPT = '/Users/tarikmoody/Projects/domes/concept-frames/01_spread-dusk.png'
# boxes (x0, y0, x1, y1): dome bodies below the caps; page = open lawn / paper either side of the drive
REGIONS = {
    'concept': {  # 1376 x 768
        'domes': [(240, 250, 520, 450), (570, 120, 820, 290), (860, 250, 1140, 450)],
        'page': [(90, 560, 460, 650), (900, 540, 1300, 640)],
    },
    'render': {  # 1512 x 762, pose: traveller (3.0, 10.6), distance 34, pitch 40, yaw -45, fov 38
        'domes': [(300, 150, 620, 360), (640, 20, 890, 190), (890, 140, 1210, 350)],
        'page': [(150, 560, 420, 650), (880, 520, 1150, 620)],
    },
}

def mean(img, boxes):
    px = np.concatenate([img[y0:y1, x0:x1].reshape(-1, 3) for x0, y0, x1, y1 in boxes])
    return px.mean(0)

def lab(rgb):
    return rgb2lab(np.array(rgb, float).reshape(1, 1, 3) / 255)[0, 0]

render = np.asarray(Image.open(sys.argv[1]).convert('RGB'))
concept = np.asarray(Image.open(sys.argv[2] if len(sys.argv) > 2 else CONCEPT).convert('RGB'))
for region in ('domes', 'page'):
    r = mean(render, REGIONS['render'][region]); c = mean(concept, REGIONS['concept'][region])
    lr, lc = lab(r), lab(c)
    print(f'{region:5s} render rgb {np.round(r).astype(int)} L*{lr[0]:.1f}  concept rgb {np.round(c).astype(int)} L*{lc[0]:.1f}  dE00 {deltaE_ciede2000(lr, lc):.1f}')

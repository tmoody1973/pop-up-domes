# Packs the generated interior card art (gemini sheets on flat magenta, see PROMPTS.md here) into the free band of the
# papertrails art atlas (public/textures/art/atlas.webp, y >= BAND_Y is empty) and writes atlas.json entries in the
# same shape as the shipped sprites: rect [x, y, w, h] (px, y top-down), outline (normalised to the rect, y UP from the
# sprite's bottom, slightly outside the die-cut so the alpha discard does the fine cut), aspect = w / h, kind, tone.
# Idempotent: clears the band and every `int_*` key first. Run: python3 tools/art/pack_interiors.py (from app/).
import json, os
import numpy as np
from PIL import Image
from scipy import ndimage
from skimage import measure

HERE = os.path.dirname(os.path.abspath(__file__))
ATLAS = os.path.join(HERE, '..', '..', 'public', 'textures', 'art')
BAND_Y = 2620  # first free row (shipped sprites end at y = 2578)
PAD = 10
# sheet -> sprite names in reading order (row-major, as laid out by the prompt's 3 x 2 grid)
SHEETS = {
    'sheet_desert.png': ['int_agave', 'int_tree_aloe', 'int_red_spire', 'int_red_outcrop', 'int_fan_palm', 'int_organ_cactus'],
    'sheet_tropical.png': ['int_tall_palm', 'int_banana', 'int_monstera', 'int_canopy_tree', 'int_tree_fern', 'int_elephant_ear'],
    # wave6-Q (appended after the wave3 sheets so their rects do not move). None = a sprite on the sheet that is skipped.
    'sheet_desert2.png': ['int_sand_spire', 'int_sand_ledge', 'int_blue_fan_palm', 'int_column_cactus', 'int_euphorbia', 'int_yellow_bush'],
    'sheet_show1.png': ['int_gazebo_white', 'int_pergola', 'int_red_shrub', None, 'int_drift_rose', 'int_drift_purple', 'int_coleus'],
    'sheet_mix1.png': ['int_orn_grass', 'int_stone_wall', 'int_metal_bench', 'int_feather_palm', 'int_strap_clump', 'int_conifer'],
}
# wave6-Q: backlit / paled copies of generated sprites (judges: "brighter saturated backlit greens, not dull olive").
# name -> (source int_* sprite, saturation x, brightness x). Pixels derived from our own generated art only.
LIT = {
    'int_canopy_lit': ('int_canopy_tree', 1.7, 1.22),
    'int_tall_palm_lit': ('int_tall_palm', 1.6, 1.18),
    'int_banana_lit': ('int_banana', 1.5, 1.15),
    'int_monstera_lit': ('int_monstera', 1.7, 1.25),
    'int_elephant_lit': ('int_elephant_ear', 1.6, 1.2),
    # desert judges: rocks pale salmon-tan sandstone, not brick red (the warm dome light reddens the generated spire)
    'int_sand_spire_pale': ('int_sand_spire', 0.6, 1.12),
}


def key_out(rgb):
    """Alpha from the magenta key: distance from #FF00FF, soft edge; holes inside a sprite are kept opaque."""
    r, g, b = [rgb[..., i].astype(np.float32) for i in range(3)]
    mag = np.minimum(r, b) - g  # ~255 on pure magenta, low on any plant / rock colour
    a = np.clip((150 - mag) / 60, 0, 1)
    return a


def outline_of(mask):
    """Simplified outer contour of a binary mask (h, w), normalised: x 0..1 left->right, y 0..1 bottom->top."""
    h, w = mask.shape
    m = ndimage.binary_dilation(ndimage.binary_fill_holes(mask), iterations=3)
    padded = np.pad(m, 1).astype(np.float32)
    cs = measure.find_contours(padded, 0.5)
    c = max(cs, key=len) - 1  # (row, col)
    poly = measure.approximate_polygon(c, tolerance=2.2)
    if len(poly) > 2 and np.allclose(poly[0], poly[-1]):
        poly = poly[:-1]
    pts = [[round(float(np.clip(x / (w - 1), 0, 1)), 4), round(float(np.clip(1 - y / (h - 1), 0, 1)), 4)] for y, x in poly]
    return pts


def sprites_of(path, names):
    im = np.asarray(Image.open(path).convert('RGB'))
    a = key_out(im)
    lab, n = ndimage.label(a > 0.5)
    sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    big = [i + 1 for i in np.argsort(sizes)[::-1][: len(names)]]
    boxes = [(ndimage.find_objects((lab == k).astype(int))[0], k) for k in big]
    # reading order: by row band (centre y / third of the height), then x
    H = im.shape[0]
    boxes.sort(key=lambda b: (int(((b[0][0].start + b[0][0].stop) / 2) / (H / 2)), b[0][1].start))
    out = []
    for name, ((sy, sx), k) in zip(names, boxes):
        y0, y1 = max(0, sy.start - 4), min(H, sy.stop + 4)
        x0, x1 = max(0, sx.start - 4), min(im.shape[1], sx.stop + 4)
        rgb = im[y0:y1, x0:x1]
        al = a[y0:y1, x0:x1]
        comp = ndimage.binary_dilation(lab[y0:y1, x0:x1] == k, iterations=2)
        al = al * comp  # drop stray specks of neighbouring sprites
        # despill: pull magenta fringe toward the cream die-cut rim
        rgbf = rgb.astype(np.float32)
        # every pixel: no plant / rock colour has blue AND red well above green, so any such excess is key fringe
        spill = np.clip((np.minimum(rgbf[..., 0], rgbf[..., 2]) - rgbf[..., 1] - 12) / 90, 0, 1)[..., None]
        rgbf = rgbf * (1 - spill) + np.array([239, 228, 207], np.float32) * spill
        rgba = np.dstack([np.clip(rgbf, 0, 255), al * 255]).astype(np.uint8)
        tone = '#%02X%02X%02X' % tuple(int(v) for v in rgb[al > 0.9].mean(axis=0))
        out.append((name, Image.fromarray(rgba, 'RGBA'), outline_of(al > 0.5), tone))
    return out


def main():
    jpath = os.path.join(ATLAS, 'atlas.json')
    j = json.load(open(jpath))
    j['sprites'] = {k: v for k, v in j['sprites'].items() if not k.startswith('int_')}
    atlas = Image.open(os.path.join(ATLAS, 'atlas.webp')).convert('RGBA')
    AW, AH = atlas.size
    atlas.paste((0, 0, 0, 0), (0, BAND_Y, AW, AH))
    x, y, row_h = PAD, BAND_Y, 0
    for sheet, names in SHEETS.items():
        for name, img, outline, tone in sprites_of(os.path.join(HERE, sheet), names):
            if name is None:
                continue
            w, h = img.size
            if x + w + PAD > AW:
                x, y, row_h = PAD, y + row_h + PAD, 0
            assert y + h <= AH, 'atlas band full'
            atlas.paste(img, (x, y))
            j['sprites'][name] = {'rect': [x, y, w, h], 'outline': outline, 'aspect': round(w / h, 4), 'kind': 'interior', 'tone': tone}
            print(f'{name:18s} rect {[x, y, w, h]}  outline {len(outline)} pts  tone {tone}')
            x += w + PAD
            row_h = max(row_h, h)
    from PIL import ImageEnhance
    for name, (src, sat, gain) in LIT.items():
        sx, sy, w, h = j['sprites'][src]['rect']
        img = atlas.crop((sx, sy, sx + w, sy + h))
        a = img.getchannel('A')
        rgb = ImageEnhance.Brightness(ImageEnhance.Color(img.convert('RGB')).enhance(sat)).enhance(gain)
        img = rgb.convert('RGBA'); img.putalpha(a)
        if x + w + PAD > AW:
            x, y, row_h = PAD, y + row_h + PAD, 0
        assert y + h <= AH, 'atlas band full'
        atlas.paste(img, (x, y))
        j['sprites'][name] = {**j['sprites'][src], 'rect': [x, y, w, h]}
        print(f'{name:18s} rect {[x, y, w, h]}  (lit copy of {src})')
        x += w + PAD
        row_h = max(row_h, h)
    atlas.save(os.path.join(ATLAS, 'atlas.webp'), 'WEBP', quality=95, method=6)
    json.dump(j, open(jpath, 'w'), separators=(',', ':'))


if __name__ == '__main__':
    main()

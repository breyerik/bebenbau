"""Erzeugt die App-Icons (PNG) für Bebenbau."""
from PIL import Image, ImageDraw
import os, sys
def icon(size, out):
    S = 512
    im = Image.new('RGB', (S, S), '#ffb703'); d = ImageDraw.Draw(im)
    for k in range(-S, S * 2, 64):
        d.polygon([(k, S - 90), (k + 32, S - 90), (k + 32 - 90, S), (k - 90, S)], fill='#1e2430')
    d.rectangle([0, S - 96, S, S - 90], fill='#1e2430')
    # wackelndes Fachwerk
    import math
    def P(x, y):
        sway = 0.10 * y
        return (256 + (x + sway) * 1.0, S - 120 - y)
    cols = [-90, 90]; lv = [0, 110, 220, 320]
    W = 22
    for i in range(len(lv) - 1):
        y0, y1 = lv[i], lv[i + 1]
        for c in cols: d.line([P(c, y0), P(c, y1)], fill='#1e2430', width=W)
        d.line([P(-90, y1), P(90, y1)], fill='#1e2430', width=W)
        d.line([P(-90, y0), P(90, y1)], fill='#3f6c99', width=12)
        d.line([P(90, y0), P(-90, y1)], fill='#3f6c99', width=12)
    for c in cols:
        for y in lv:
            x, yy = P(c, y); d.ellipse([x - 16, yy - 16, x + 16, yy + 16], fill='#fff', outline='#1e2430', width=6)
    for c in cols:
        x, yy = P(c, 0); d.polygon([(x, yy), (x - 26, yy + 34), (x + 26, yy + 34)], fill='#d9480f')
    # Bebenlinien
    for k, off in enumerate([40, 70]):
        d.arc([60 - off, 120 - off, 60 + off, 120 + off], 200, 300, fill='#1e2430', width=10)
        d.arc([452 - off, 120 - off, 452 + off, 120 + off], 240, 340, fill='#1e2430', width=10)
    im.resize((size, size), Image.LANCZOS).save(out)
os.makedirs(sys.argv[1], exist_ok=True)
for s in (180, 192, 512): icon(s, os.path.join(sys.argv[1], f'icon-{s}.png'))

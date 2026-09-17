#!/usr/bin/env python3
"""
AniKuoshi v1.1 — branding SVG generator (fontTools edition).

Mark: kanji 「推」 (oshi — "your favorite", from anime fandom; echoes the
"-koshi" in AniKuoshi) in white on the brand gradient tile (#8b5cf6 →
#d946ef), with a subtle play-triangle accent. Clean, dark-theme friendly,
legible at 16px. Katakana caption アニクオシ on the horizontal lockup.

Glyphs are embedded as real vector paths — svgs are fully portable.

Writes: public/logo.svg, public/logo-mark.svg, public/favicon.svg
Then run scripts/gen-brand-raster.mjs (sharp) for PNG/ICO derivatives.
"""
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
import json, os

ROOT = "/home/z/my-project/work/anikuoshi"
OUT = os.path.join(ROOT, "public")

JP_FONT = "/usr/share/fonts/truetype/chinese/SarasaMonoSC-Bold.ttf"
BRAND_FROM, BRAND_TO = "#8b5cf6", "#d946ef"

jp = TTFont(JP_FONT)
cmap = jp.getBestCmap()
glyphset = jp.getGlyphSet()
UPM = jp["head"].unitsPerEm


def text_pieces(text):
    """[(path_commands_fontunits, x_advance_units, y_offset_units), ...]"""
    pieces = []
    for ch in text:
        gname = cmap.get(ord(ch))
        if gname is None:
            gname = cmap.get(ord(" "))  # fallback space
        glyph = glyphset[gname]
        pen = SVGPathPen(glyphset)
        glyph.draw(pen)
        pieces.append({"d": pen.getCommands(), "adv": glyph.width, "ch": ch})
    return pieces


def ink_bounds(pieces):
    """bounds of the whole run, font units, y-up"""
    minX = minY = float("inf")
    maxX = maxY = float("-inf")
    pen_x = 0
    for p in pieces:
        bp = BoundsPen(glyphset)
        glyphset[cmap.get(ord(p["ch"]), cmap[ord(" ")])].draw(bp)
        if bp.bounds:
            x0, y0, x1, y1 = bp.bounds
            minX = min(minX, pen_x + x0)
            maxX = max(maxX, pen_x + x1)
            minY = min(minY, y0)
            maxY = max(maxY, y1)
        pen_x += p["adv"]
    if not minX <= maxX:
        minX, maxX, minY, maxY = 0, UPM, 0, UPM * 0.72
    return minX, minY, maxX, maxY


def text_path(text, font_size, box_x, box_y, box_w, box_h, letter_spacing=0, fill="#ffffff", opacity=None):
    """SVG path elements for `text` centered in the box (y-down svg coords)."""
    s = font_size / UPM
    pieces = text_pieces(text)
    minX, minY, maxX, maxY = ink_bounds(pieces)
    ink_w = (maxX - minX) * s
    n = max(1, len(pieces) - 1)
    total_w = ink_w + letter_spacing * n
    # start so that ink (+tracking) is centered
    tx0 = box_x + (box_w - total_w) / 2 - minX * s
    ty0 = box_y + box_h / 2 + ((maxY + minY) / 2) * s  # for scale(s, -s)
    parts = []
    pen = 0
    op = f' opacity="{opacity}"' if opacity else ""
    for i, p in enumerate(pieces):
        tx = tx0 + pen * s + letter_spacing * i
        if p["d"]:
            parts.append(
                f'<path fill="{fill}"{op} transform="translate({tx:.2f} {ty0:.2f}) scale({s:.6f} {-s:.6f})" d="{p["d"]}"/>'
            )
        pen += p["adv"]
    return "\n  ".join(parts)


def grad(id_):
    return (f'<linearGradient id="{id_}" x1="0" y1="0" x2="1" y2="1">'
            f'<stop offset="0" stop-color="{BRAND_FROM}"/>'
            f'<stop offset="1" stop-color="{BRAND_TO}"/></linearGradient>')


def play(cx, cy, size, opacity=0.9):
    h = size * 0.577
    return (f'<path d="M {cx - size/2} {cy - h:.1f} L {cx + size/2} {cy} L {cx - size/2} {cy + h:.1f} Z" '
            f'fill="#ffffff" opacity="{opacity}"/>')


kanji512 = text_path("推", 300, 96, 96, 320, 320)

icon_svg = f'''<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>{grad("g")}</defs>
  <rect width="512" height="512" rx="115" fill="url(#g)"/>
  {kanji512}
  {play(400, 402, 74)}
</svg>'''

maskable_svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>{grad("g")}</defs>
  <rect width="512" height="512" fill="url(#g)"/>
  {text_path("推", 222, 145, 145, 222, 222)}
  {play(366, 366, 50)}
</svg>'''

apple_svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>{grad("g")}</defs>
  <rect width="512" height="512" fill="url(#g)"/>
  {text_path("推", 256, 128, 128, 256, 256)}
  {play(376, 378, 58)}
</svg>'''

tile_kanji = text_path("推", 94, 33, 33, 94, 94)
ani = text_path("Ani", 74, 190, 46, 140, 88)
kuoshi = text_path("Kuoshi", 74, 312, 46, 282, 88, fill="url(#g)")
kana = text_path("アニクオシ", 27, 200, 126, 262, 34, opacity=0.55)

logo_svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="620" height="180" viewBox="0 0 620 180">
  <defs>{grad("g")}</defs>
  <rect x="14" y="14" width="152" height="152" rx="34" fill="url(#g)"/>
  {tile_kanji}
  {ani}
  {kuoshi}
  {kana}
</svg>'''

logo_mark_svg = f'''<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>{grad("g")}</defs>
  <rect width="512" height="512" rx="115" fill="url(#g)"/>
  {kanji512}
  {play(400, 402, 74)}
</svg>'''

favicon_svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 512 512">
  <defs>{grad("g")}</defs>
  <rect width="512" height="512" rx="115" fill="url(#g)"/>
  {kanji512}
</svg>'''

files = {
    "logo.svg": logo_svg,
    "logo-mark.svg": logo_mark_svg,
    "favicon.svg": favicon_svg,
}
for name, svg in files.items():
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        f.write(svg)
    print("wrote", name, len(svg), "bytes")

# svg variants needed by the rasterizer
raster = {
    "icon-512.svg": icon_svg,
    "icon-192.svg": icon_svg.replace('width="512" height="512"', 'width="192" height="192"'),
    "icon-maskable-512.svg": maskable_svg,
    "icon-maskable-192.svg": maskable_svg.replace('width="512" height="512"', 'width="192" height="192"'),
    "apple-touch-icon.svg": apple_svg,
}
tmp = os.path.join(ROOT, "scripts", "tmp-svg")
os.makedirs(tmp, exist_ok=True)
for name, svg in raster.items():
    with open(os.path.join(tmp, name), "w", encoding="utf-8") as f:
        f.write(svg)
json.dump({"tmp": tmp}, open(os.path.join(tmp, "meta.json"), "w"))
print("raster sources in", tmp)

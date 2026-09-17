/**
 * AniKuoshi v1.1 — branding asset generator (fontkit edition).
 *
 * Design direction: Japanese kanji mark 「推」 ("oshi" — your favorite, from
 * anime fandom culture; echoes the "-koshi" in AniKuoshi) on the brand
 * gradient tile (#8b5cf6 → #d946ef), minimal, dark-theme friendly, legible
 * at 16px. Katakana caption アニクオシ on the horizontal lockup.
 *
 * Glyphs are embedded as real vector paths so every .svg is portable —
 * no viewer font dependencies.
 */
import * as fontkit from "fontkit";
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "public");
const ICONS = path.join(OUT, "icons");

const BRAND = { from: "#8b5cf6", to: "#d946ef" };

const JP_FONT = "/usr/share/fonts/truetype/chinese/SarasaMonoSC-Bold.ttf";
const LAT_FONT = "/usr/share/fonts/truetype/chinese/SarasaMonoSC-Bold.ttf";

/**
 * Lay out `text` centered inside the box (x,y,w,h), fontSize in px.
 * Returns SVG path data with y-down coordinates.
 */
function glyphPath(font, text, fontSize, boxX, boxY, boxW, boxH, letterSpacing = 0) {
  const run = font.layout(text);
  const s = fontSize / font.unitsPerEm;
  const glyphs = run.glyphs;
  const positions = run.positions;

  // total advance width (font units)
  let advance = 0;
  for (const p of positions) advance += p.xAdvance;
  advance = advance * s + letterSpacing * (glyphs.length - 1);

  // ink bbox (font units, y-up) over the whole run
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let pen = 0;
  const pieces = [];
  for (let i = 0; i < glyphs.length; i++) {
    const g = glyphs[i];
    const p = g.path;
    const b = g.bbox || p.bbox;
    if (b && b.minX !== undefined && b.maxX > b.minX) {
      minX = Math.min(minX, pen + b.minX);
      maxX = Math.max(maxX, pen + b.maxX);
      minY = Math.min(minY, b.minY);
      maxY = Math.max(maxY, b.maxY);
    }
    pieces.push({ path: p, dx: pen, dy: positions[i].yOffset });
    pen += positions[i].xAdvance;
  }
  if (!isFinite(minX)) { minX = 0; maxX = advance / s; minY = 0; maxY = font.unitsPerEm * 0.7; }

  const inkW = (maxX - minX) * s;
  // horizontal: center ink within the box, respecting advance for multi-glyph
  const baseTx = boxX + (boxW - inkW) / 2 - minX * s;
  const baseTy = boxY + boxH / 2 + ((maxY + minY) / 2) * s; // derived for scale(s,-s)

  const parts = [];
  let extra = 0;
  for (const piece of pieces) {
    const tx = baseTx + piece.dx * s + extra;
    const ty = baseTy - piece.dy * s;
    parts.push(
      `<path transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(6)} ${(-s).toFixed(6)})" d="${piece.path.toSVG()}"/>`
    );
    extra += letterSpacing;
  }
  return parts.join("\n  ");
}

function defsGradient(id) {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BRAND.from}"/>
      <stop offset="1" stop-color="${BRAND.to}"/>
    </linearGradient>`;
}

/** play-triangle accent (subtle, bottom-right) */
function playAccent(cx, cy, size, opacity) {
  const h = size * 0.577;
  return `<path d="M ${cx - size / 2} ${cy - h} L ${cx + size / 2} ${cy} L ${cx - size / 2} ${cy + h} Z"
     fill="#ffffff" opacity="${opacity}"/>`;
}

async function main() {
  const jp = fontkit.openSync(JP_FONT);
  const lat = fontkit.openSync(LAT_FONT);
  const hasKanji = Boolean(jp.hasGlyphForCodePoint?.(0x63a8) ?? jp.characterSet?.includes(0x63a8));
  console.log("kanji 推 in font:", hasKanji);
  await fs.mkdir(ICONS, { recursive: true });

  /* ---------------------------------------------------------- tile mark */
  const kanji512 = glyphPath(jp, "推", 300, 96, 96, 320, 320);

  // transparent-corner "any" icon: rounded tile fills canvas
  const iconSvg = (size) => `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>${defsGradient("g")}</defs>
  <rect width="512" height="512" rx="115" fill="url(#g)"/>
  <path d="${kanji512}" fill="#ffffff" transform="translate(0 0)"/>
  ${playAccent(400, 402, 74, 0.9)}
</svg>`;

  // maskable: full-bleed, content inside 80% safe zone
  const maskableSvg = (size) => {
    const kanjiM = glyphPath(jp, "推", 225, 143, 143, 226, 226);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>${defsGradient("g")}</defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <path d="${kanjiM}" fill="#ffffff"/>
  ${playAccent(368, 368, 52, 0.9)}
</svg>`;
  };

  const appleSvg = (size) => {
    const kanjiM = glyphPath(jp, "推", 258, 127, 127, 258, 258);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>${defsGradient("g")}</defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <path d="${kanjiM}" fill="#ffffff"/>
  ${playAccent(378, 380, 60, 0.9)}
</svg>`;
  };

  /* ------------------------------------------------------ horizontal logo */
  const tileKanji = glyphPath(jp, "推", 94, 33, 33, 94, 94);
  const ani = glyphPath(lat, "Ani", 74, 196, 46, 132, 88);
  const kuoshi = glyphPath(lat, "Kuoshi", 74, 326, 46, 268, 88);
  const kana = glyphPath(jp, "アニクオシ", 27, 200, 126, 260, 34);

  const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="620" height="180" viewBox="0 0 620 180">
  <defs>${defsGradient("g")}</defs>
  <rect x="14" y="14" width="152" height="152" rx="34" fill="url(#g)"/>
  <path d="${tileKanji}" fill="#ffffff"/>
  <path d="${ani}" fill="#ffffff"/>
  <path d="${kuoshi}" fill="url(#g)"/>
  <path d="${kana}" fill="#ffffff" opacity="0.55"/>
</svg>`;

  const logoMarkSvg = `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>${defsGradient("g")}</defs>
  <rect width="512" height="512" rx="115" fill="url(#g)"/>
  <path d="${kanji512}" fill="#ffffff"/>
  ${playAccent(400, 402, 74, 0.9)}
</svg>`;

  const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 512 512">
  <defs>${defsGradient("g")}</defs>
  <rect width="512" height="512" rx="115" fill="url(#g)"/>
  <path d="${kanji512}" fill="#ffffff"/>
</svg>`;

  /* ------------------------------------------------------------- write svgs */
  await fs.writeFile(path.join(OUT, "logo.svg"), logoSvg);
  await fs.writeFile(path.join(OUT, "logo-mark.svg"), logoMarkSvg);
  await fs.writeFile(path.join(OUT, "favicon.svg"), faviconSvg);

  /* ------------------------------------------------------------- rasterize */
  const png = async (svg, size, file) =>
    sharp(Buffer.from(svg)).resize(size, size).png().toFile(path.join(ICONS, file));

  await png(iconSvg(192), 192, "icon-192.png");
  await png(iconSvg(512), 512, "icon-512.png");
  await png(maskableSvg(192), 192, "icon-maskable-192.png");
  await png(maskableSvg(512), 512, "icon-maskable-512.png");
  await png(appleSvg(180), 180, "apple-touch-icon.png");

  /* ------------------------------------------------------------------ ico */
  const icoSizes = [16, 32, 48];
  const pngs = await Promise.all(
    icoSizes.map(async (s) => ({
      size: s,
      data: await sharp(Buffer.from(faviconSvg)).resize(s, s).png().toBuffer(),
    }))
  );
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  const offset = 6 + 16 * pngs.length;
  let cur = offset;
  for (const { size, data } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size === 256 ? 0 : size, 0);
    e.writeUInt8(size === 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(cur, 12);
    entries.push(e);
    cur += data.length;
  }
  const ico = Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
  await fs.writeFile(path.join(OUT, "favicon.ico"), ico);

  console.log("brand assets written to", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

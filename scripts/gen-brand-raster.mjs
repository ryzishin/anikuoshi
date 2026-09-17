/**
 * AniKuoshi v1.1 — rasterize brand SVGs (from gen-brand-paths.py) into
 * PWA icons + favicon.ico using sharp.
 */
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "public");
const ICONS = path.join(OUT, "icons");
const TMP = path.join(ROOT, "scripts", "tmp-svg");

async function main() {
  await fs.mkdir(ICONS, { recursive: true });

  const read = (name) => fs.readFile(path.join(TMP, name));
  const pngTo = async (buf, size, file) =>
    sharp(buf).resize(size, size).png().toFile(path.join(ICONS, file));

  await pngTo(await read("icon-512.svg"), 512, "icon-512.png");
  await pngTo(await read("icon-192.svg"), 192, "icon-192.png");
  await pngTo(await read("icon-maskable-512.svg"), 512, "icon-maskable-512.png");
  await pngTo(await read("icon-maskable-192.svg"), 192, "icon-maskable-192.png");
  await pngTo(await read("apple-touch-icon.svg"), 180, "apple-touch-icon.png");

  // favicon.ico — 16/32/48 PNG-compressed ICO container
  const fav = await fs.readFile(path.join(OUT, "favicon.svg"));
  const icoSizes = [16, 32, 48];
  const pngs = await Promise.all(
    icoSizes.map(async (s) => ({
      size: s,
      data: await sharp(fav).resize(s, s).png().toBuffer(),
    }))
  );
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let cur = 6 + 16 * pngs.length;
  for (const { size, data } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size, 0);
    e.writeUInt8(size, 1);
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

  // cleanup tmp svgs
  await fs.rm(TMP, { recursive: true, force: true });
  console.log("PNG + ICO brand assets written");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

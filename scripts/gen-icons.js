/* Generate AniKuoshi PWA icons (SVG brand mark -> PNG) via sharp. */
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const svg = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#14101f"/>
      <stop offset="100%" stop-color="#1e1428"/>
    </linearGradient>
    <linearGradient id="k" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#a78bfa"/>
      <stop offset="100%" stop-color="#e879f9"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <circle cx="256" cy="256" r="170" fill="none" stroke="url(#k)" stroke-width="14" stroke-linecap="round" stroke-dasharray="700 380" transform="rotate(-45 256 256)"/>
  <circle cx="256" cy="256" r="170" fill="none" stroke="#ffffff22" stroke-width="14" stroke-linecap="round" stroke-dasharray="10 30"/>
  <!-- stylized K monogram -->
  <g fill="url(#k)">
    <rect x="168" y="150" width="42" height="212" rx="21"/>
    <path d="M 268 256 L 356 150 L 356 216 L 306 276 L 362 362 L 300 362 L 254 288 L 268 272 Z" transform="translate(-18,0)"/>
  </g>
  <circle cx="352" cy="160" r="16" fill="#e879f9"/>
</svg>`;

(async () => {
  const outDir = path.join(process.cwd(), "public", "icons");
  fs.mkdirSync(outDir, { recursive: true });
  for (const size of [192, 512, 180]) {
    const name = size === 180 ? "apple-touch-icon.png" : `icon-${size}.png`;
    await sharp(Buffer.from(svg(size))).resize(size, size).png().toFile(path.join(outDir, name));
  }
  // maskable (full-bleed background, more padding)
  const maskable = svg(512).replace('rx="112"', 'rx="0"');
  await sharp(Buffer.from(maskable)).resize(512, 512).png().toFile(path.join(outDir, "icon-maskable-512.png"));
  console.log("icons generated:", fs.readdirSync(outDir));
})();

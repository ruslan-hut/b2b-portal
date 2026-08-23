#!/usr/bin/env node
/**
 * Renders the brand mark (scripts/brand-mark.js) into every asset the app,
 * the browser and the OS need: one SVG plus the PNG/ICO raster set.
 *
 * Run it when the mark's geometry changes:  node scripts/gen-brand-assets.js
 *
 * Deliberately dependency-free. The mark is analytic geometry, so a
 * supersampled point test rasterises it exactly — no SVG renderer, no native
 * image library, nothing for `npm ci` to fail on. The PNG writer below is the
 * minimum spec-compliant encoder (8-bit RGBA, no filtering).
 *
 * The rasters cannot follow the theme — a favicon is a file, not a stylesheet
 * — so they are baked in the ink colour below. The in-app mark is inline SVG
 * on `currentColor` (icons.ts, key `brand_mark`) and does follow it.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { pathData, pathList, rasterize } = require('./brand-mark');

const hex = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');

/* The mark is 60% grey wherever it cannot take `currentColor` — the SVG
   favicon's own stylesheet and every raster. Black read as a hard, heavy dot
   next to the browser's own chrome; INK_DARK is the same 60% measured from the
   other end, so the mark gives up the same contrast on a dark ground. */
const INK = [0x66, 0x66, 0x66];       // #666 — 60% black, on a light ground
const INK_DARK = [0x99, 0x99, 0x99];  // #999 — its mirror, on a dark one
const PLATE = [0xff, 0xff, 0xff]; // behind the mark where transparency is not allowed
/* A favicon sits on a tab strip whose colour the page does not control, and
   the rasters cannot flip with the scheme. Chrome's dark tabs rendered the
   mark as a hole; the halo is what makes it legible there, and it matters more
   at 60% grey than it did at black. It is invisible on the light strip, so both
   themes are served by the one file. */
const HALO = [0xff, 0xff, 0xff];

const ASSETS = path.join(__dirname, '..', 'src', 'assets');

/* ---------------------------------------------------------------- PNG ---- */

let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type: RGBA
  // 10..12 stay zero: deflate, adaptive filtering, no interlace

  // One filter byte (0 = None) in front of every scanline.
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** ICO container holding PNG-compressed entries (Vista+ reads these). */
function encodeIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);

  const dir = Buffer.alloc(16 * entries.length);
  let offset = header.length + dir.length;
  entries.forEach(({ size, png }, i) => {
    const b = i * 16;
    dir[b] = size >= 256 ? 0 : size;      // 0 means 256
    dir[b + 1] = size >= 256 ? 0 : size;
    dir[b + 2] = 0;                        // palette size
    dir[b + 3] = 0;                        // reserved
    dir.writeUInt16LE(1, b + 4);           // colour planes
    dir.writeUInt16LE(32, b + 6);          // bits per pixel
    dir.writeUInt32LE(png.length, b + 8);
    dir.writeUInt32LE(offset, b + 12);
    offset += png.length;
  });

  return Buffer.concat([header, dir, ...entries.map((e) => e.png)]);
}

/* ------------------------------------------------------------- output ---- */

function png(file, size, { bg = null, inset = 0.08, outline = null } = {}) {
  const buf = encodePng(size, rasterize(size, INK, bg, inset, { outline }));
  fs.writeFileSync(path.join(ASSETS, file), buf);
  console.log(`  ${file}  ${size}x${size}  ${(buf.length / 1024).toFixed(1)} kB`);
}

console.log('brand mark →');

// The icon registry's copy — what the header actually renders. Rewritten in
// place between the two markers so the registry can never drift from the
// sector table; everything else in icons.ts is hand-drawn and left alone.
const REGISTRY = path.join(__dirname, '..', 'src', 'app', 'shared', 'components', 'icon', 'icons.ts');
const OPEN = '    /* GENERATED — npm run gen:brand */';
const CLOSE = '    /* END GENERATED */';
const registry = fs.readFileSync(REGISTRY, 'utf8');
const from = registry.indexOf(OPEN);
const to = registry.indexOf(CLOSE);
if (from === -1 || to === -1) {
  throw new Error(`icons.ts is missing the generated brand_mark markers (${OPEN} … ${CLOSE})`);
}
// R=10 in a 24 viewBox: the 20x20 live area every other icon in the set uses.
const body = pathList(12, 12, 10).map((d) => `      '${d}',`).join('\n');
fs.writeFileSync(REGISTRY, registry.slice(0, from + OPEN.length) + '\n' + body + '\n' + registry.slice(to));
console.log('  icons.ts  brand_mark');

/* The favicon browsers actually use. An SVG favicon is resolution-independent,
   so the tab gets a crisp mark at any DPI, and it can carry its own
   `prefers-color-scheme` rule — which is the real answer to a dark mark on a
   dark tab strip. The halo on the rasters below is the fallback for whatever
   does not take an SVG icon.
   The gap is widened here because this file is only ever painted small. */
const FAVICON_GAP = 14;
fs.writeFileSync(path.join(ASSETS, 'favicon', 'favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img" aria-label="Logo">
  <style>
    path { fill: ${hex(INK)}; }
    @media (prefers-color-scheme: dark) { path { fill: ${hex(INK_DARK)}; } }
  </style>
${pathList(12, 12, 11, 3, FAVICON_GAP).map((d) => `  <path d="${d}"/>`).join('\n')}
</svg>
`);
console.log('  favicon/favicon.svg  (scheme-aware)');

// The standalone SVG, for anywhere that cannot take the component. 24x24 to
// sit in the icon set's coordinate space; `currentColor` so a brand's
// --color-primary reaches it wherever inlining is possible.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="Logo">
  <path d="${pathData(12, 12, 10.5)}"/>
</svg>
`;
fs.writeFileSync(path.join(ASSETS, 'branding', 'logo.svg'), svg);
console.log('  branding/logo.svg');

// Header/e-mail fallback for contexts that cannot take inline SVG.
png('branding/logo.png', 512);

// Favicons and the iOS home-screen icon. Transparent where the platform
// composites onto its own surface; plated white where it does not.
fs.writeFileSync(
  path.join(ASSETS, 'favicon', 'favicon.ico'),
  encodeIco([16, 32, 48, 64, 128, 256].map((size) => ({
    size,
    png: encodePng(size, rasterize(size, INK, null, 0.06, { outline: HALO })),
  })))
);
console.log('  favicon/favicon.ico  16/32/48/64/128/256');

png('favicon/icon-192.png', 192, { inset: 0.06, outline: HALO });
png('favicon/icon-512.png', 512, { inset: 0.06, outline: HALO });
png('favicon/apple-touch-icon.png', 180, { bg: PLATE, inset: 0.14 });

// Maskable icons are cropped to an arbitrary shape by the launcher, so the
// mark has to sit inside the 80%-diameter safe zone (radius <= 0.4 of the
// edge, hence inset >= 0.1) and the plate has to be opaque.
png('favicon/icon-192-maskable.png', 192, { bg: PLATE, inset: 0.16 });
png('favicon/icon-512-maskable.png', 512, { bg: PLATE, inset: 0.16 });

// The manifest's own set. 192 and 512 are declared `any maskable`, so the
// whole set keeps the maskable safe-zone inset.
for (const size of [72, 96, 128, 144, 152, 192, 384, 512]) {
  png(`icons/icon-${size}x${size}.png`, size, { bg: PLATE, inset: 0.16 });
}

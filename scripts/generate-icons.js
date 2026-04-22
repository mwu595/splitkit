/**
 * Generates all required PWA icons for Split Kit.
 * Run once: node scripts/generate-icons.js
 *
 * Outputs to public/icons/:
 *   icon-192x192.png       — standard PWA icon
 *   icon-512x512.png       — standard PWA icon
 *   icon-maskable-512x512.png — maskable (full-bleed red bg)
 *   apple-touch-icon.png   — 180×180 for iOS
 *   og-image.png           — 1200×630 for social sharing
 *   favicon.ico            — 32×32 (saved as PNG, renamed .ico)
 */
import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '../public/icons');

const RED   = '#E8302A';
const DARK  = '#0F0E0E';
const WHITE = '#FFFFFF';

// ─── SVG builder helpers ──────────────────────────────────────────────────────

/** Standard icon: dark bg + red circle + "SK" */
function iconSvg(size) {
  const circle = size * 0.56;
  const cx = size / 2;
  const cy = size / 2;
  const fontSize = size * 0.23;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="${DARK}"/>
  <circle cx="${cx}" cy="${cy}" r="${circle / 2}" fill="${RED}"/>
  <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central"
    font-family="system-ui, -apple-system, sans-serif"
    font-weight="700" font-size="${fontSize}" fill="${WHITE}" letter-spacing="-1">SK</text>
</svg>`;
}

/** Maskable icon: full-bleed red bg + "SK" (safe zone = centre 80%) */
function maskableSvg(size) {
  const fontSize = size * 0.26;
  const cx = size / 2;
  const cy = size / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" fill="${RED}"/>
  <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central"
    font-family="system-ui, -apple-system, sans-serif"
    font-weight="700" font-size="${fontSize}" fill="${WHITE}" letter-spacing="-2">SK</text>
</svg>`;
}

/** OG image: 1200×630 */
function ogSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="${DARK}"/>
  <circle cx="480" cy="315" r="160" fill="${RED}"/>
  <text x="480" y="315" text-anchor="middle" dominant-baseline="central"
    font-family="system-ui, -apple-system, sans-serif"
    font-weight="700" font-size="110" fill="${WHITE}" letter-spacing="-3">SK</text>
  <text x="700" y="290" text-anchor="start" dominant-baseline="central"
    font-family="system-ui, -apple-system, sans-serif"
    font-weight="700" font-size="56" fill="${WHITE}" letter-spacing="-1">Split Kit</text>
  <text x="702" y="350" text-anchor="start" dominant-baseline="central"
    font-family="system-ui, -apple-system, sans-serif"
    font-weight="400" font-size="26" fill="#6E6A66">Split bills. No login required.</text>
</svg>`;
}

// ─── Generate ─────────────────────────────────────────────────────────────────

async function generate() {
  const tasks = [
    { file: 'icon-192x192.png',        svg: iconSvg(192),      size: 192  },
    { file: 'icon-512x512.png',        svg: iconSvg(512),      size: 512  },
    { file: 'icon-maskable-512x512.png', svg: maskableSvg(512), size: 512  },
    { file: 'apple-touch-icon.png',    svg: iconSvg(180),      size: 180  },
    { file: 'favicon.ico',             svg: iconSvg(32),       size: 32   },
    { file: 'og-image.png',            svg: ogSvg(),           size: null },
  ];

  for (const { file, svg } of tasks) {
    const outPath = join(OUT, file);
    await sharp(Buffer.from(svg))
      .png()
      .toFile(outPath);
    console.log(`✓ ${file}`);
  }

  console.log('\nAll icons generated in public/icons/');
}

generate().catch(err => { console.error(err); process.exit(1); });

/* One-shot: rasterize the IB monogram into PNG icons.
 * Usage: node scripts/generate-icons.mjs */
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "..", "public");

// Master design — matches public/favicon.svg (white tile, black border, "IB" no dot).
const standardSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect x="1" y="1" width="62" height="62" rx="12" fill="#FFFFFF" stroke="#0F0F0F" stroke-width="2"/>
  <text x="32" y="44" text-anchor="middle"
        font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
        font-weight="900" font-size="34" letter-spacing="-1.5" fill="#0F0F0F">IB</text>
</svg>`;

// Maskable: edge-to-edge black so Android adaptive crop keeps strong brand presence.
// IB sits inside the 80% safe zone so it survives a circle mask.
const maskableSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#0F0F0F"/>
  <text x="32" y="40" text-anchor="middle"
        font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
        font-weight="900" font-size="24" letter-spacing="-1" fill="#FFFFFF">IB</text>
</svg>`;

const targets = [
  { file: "apple-touch-icon.png", size: 180, svg: standardSvg },
  { file: "apple-touch-icon-180x180.png", size: 180, svg: standardSvg },
  { file: "pwa-64x64.png", size: 64, svg: standardSvg },
  { file: "pwa-192x192.png", size: 192, svg: standardSvg },
  { file: "pwa-512x512.png", size: 512, svg: standardSvg },
  { file: "maskable-icon-512x512.png", size: 512, svg: maskableSvg },
];

for (const t of targets) {
  const buf = await sharp(Buffer.from(t.svg))
    .resize(t.size, t.size)
    .png()
    .toBuffer();
  await writeFile(join(PUBLIC, t.file), buf);
  console.log(`wrote public/${t.file} (${t.size}x${t.size})`);
}

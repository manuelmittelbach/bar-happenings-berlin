/* One-shot: rasterize the IB monogram + OG card + favicon.ico.
 * Usage: node scripts/generate-icons.mjs */
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import icoEndec from "ico-endec";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "..", "public");
const ASSETS = join(__dirname, "..", "assets");

// Master design — matches public/favicon.svg and the live insidebars.co
// favicon: white tile (rounded), black "iB" in Helvetica Neue 900 with
// lowercase "i" + uppercase "B" and tight -1 letter-spacing.
const standardSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#FFFFFF"/>
  <text x="32" y="46" text-anchor="middle"
        font-family="'Helvetica Neue', Arial, sans-serif"
        font-weight="900" font-size="40" letter-spacing="-1" fill="#000000">iB</text>
</svg>`;

// Native app icon (Capacitor source) — same iB monogram scaled to the
// 1024×1024 source @capacitor/assets fans out into every iOS AppIcon
// variant. No built-in rounded corners: iOS applies its own squircle
// mask, and any pre-rounded PNG ends up with doubled or uneven corners.
const nativeSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#FFFFFF"/>
  <text x="512" y="736" text-anchor="middle"
        font-family="'Helvetica Neue', Arial, sans-serif"
        font-weight="900" font-size="640" letter-spacing="-16" fill="#000000">iB</text>
</svg>`;

// Maskable: edge-to-edge black so Android adaptive crop keeps strong
// brand presence. iB sits inside the 80% safe zone so it survives a
// circle mask. Font-size kept conservative to leave margin against the
// crop circle.
const maskableSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#0F0F0F"/>
  <text x="32" y="42" text-anchor="middle"
        font-family="'Helvetica Neue', Arial, sans-serif"
        font-weight="900" font-size="28" letter-spacing="-0.7" fill="#FFFFFF">iB</text>
</svg>`;

// Social-share card 1200×630 — editorial cream bg, Georgia bold uppercase headline
// with italic Georgia "tonight" accent, orange dot in wordmark + orange "?".
const ogSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#F5F1E8"/>

  <!-- Top brand row: INSIDE · BARS wordmark left, URL right -->
  <text x="80" y="68" font-family="Georgia, 'Times New Roman', Times, serif"
        font-weight="700" font-size="34" letter-spacing="-0.5" fill="#0F0F0F">INSIDE</text>
  <circle cx="220" cy="56" r="6" fill="#EE6022"/>
  <text x="240" y="68" font-family="Georgia, 'Times New Roman', Times, serif"
        font-weight="700" font-size="34" letter-spacing="-0.5" fill="#0F0F0F">BARS</text>

  <text x="1120" y="68" font-family="'Courier New', monospace"
        font-weight="400" font-size="16" letter-spacing="2" fill="#9CA3AF" text-anchor="end">INSIDEBARS.CO</text>

  <!-- Eyebrow -->
  <text x="80" y="140" font-family="'Courier New', monospace"
        font-weight="700" font-size="16" letter-spacing="3" fill="#EE6022">BERLIN'S INDEPENDENT BAR GUIDE</text>

  <!-- Headline: Georgia bold uppercase + italic "tonight" lowercase -->
  <text x="80" y="270" font-family="Georgia, 'Times New Roman', Times, serif"
        font-weight="700" font-size="100" letter-spacing="-3" fill="#0F0F0F">WHAT'S ON</text>
  <text x="80" y="370" font-family="Georgia, 'Times New Roman', Times, serif"
        font-style="italic" font-weight="400" font-size="90" letter-spacing="-2" fill="#0F0F0F">tonight</text>
  <text x="80" y="475" font-family="Georgia, 'Times New Roman', Times, serif"
        font-weight="700" font-size="100" letter-spacing="-3" fill="#0F0F0F">IN BERLIN BARS<tspan fill="#EE6022">?</tspan></text>

  <!-- Hairline + tagline -->
  <line x1="80" y1="540" x2="1120" y2="540" stroke="#0F0F0F" stroke-width="1"/>
  <text x="80" y="585" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
        font-weight="400" font-size="18" fill="#0F0F0F">Live music, quiz nights, open mics &amp; community events in small independent bars across Berlin.</text>
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

// og-image: 1200×630, not square — render at exact size, don't resize.
const ogBuf = await sharp(Buffer.from(ogSvg), { density: 144 })
  .resize(1200, 630)
  .png()
  .toBuffer();
await writeFile(join(PUBLIC, "og-image.png"), ogBuf);
console.log("wrote public/og-image.png (1200x630)");

// favicon.ico: multi-resolution ICO with 16, 32, 48 px PNG embeds.
const icoSizes = [16, 32, 48];
const icoPngs = await Promise.all(
  icoSizes.map((s) =>
    sharp(Buffer.from(standardSvg)).resize(s, s).png().toBuffer()
  )
);
const icoBuf = icoEndec.encode(icoPngs);
await writeFile(join(PUBLIC, "favicon.ico"), icoBuf);
console.log(`wrote public/favicon.ico (${icoSizes.join(", ")})`);

// Native app icon source — written once at 1024×1024 for @capacitor/assets
// to consume via `npx capacitor-assets generate --ios`. Run that command
// after this script to fan the source out into the full iOS AppIcon set.
const nativeBuf = await sharp(Buffer.from(nativeSvg))
  .resize(1024, 1024)
  .png()
  .toBuffer();
await writeFile(join(ASSETS, "icon-only.png"), nativeBuf);
console.log("wrote assets/icon-only.png (1024x1024) — run `npx capacitor-assets generate --ios` next");

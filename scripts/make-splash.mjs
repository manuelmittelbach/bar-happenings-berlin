import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const ICON = path.join(root, "assets", "icon-only.png");

async function makeSplash({ bg, out }) {
  const size = 2732;
  const iconSize = 900;
  const iconBuf = await sharp(ICON).resize(iconSize, iconSize, { fit: "contain" }).png().toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: bg },
  })
    .composite([{ input: iconBuf, gravity: "center" }])
    .png()
    .toFile(out);
  console.log("wrote", out);
}

await makeSplash({ bg: "#FFFFFF", out: path.join(root, "assets", "splash.png") });
await makeSplash({ bg: "#0F0F0F", out: path.join(root, "assets", "splash-dark.png") });

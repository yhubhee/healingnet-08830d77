// Builds the Play Store images in mobile/store from their sources:
//   store/feature-graphic.svg -> store/feature-graphic.png (1024 x 500)
//   assets/icon.png           -> store/icon-512.png        (512 x 512)
// Run from mobile/: node scripts/store-assets.mjs
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const at = (p) => resolve(root, p);

await sharp(at("store/feature-graphic.svg"), { density: 72 }).resize(1024, 500).flatten({ background: "#186E6A" }).png().toFile(at("store/feature-graphic.png"));
// The Play Store icon must be exactly 512 x 512, a PNG of at most 1 MB.
await sharp(at("assets/icon.png")).resize(512, 512).png({ compressionLevel: 9 }).toFile(at("store/icon-512.png"));

for (const f of ["store/feature-graphic.png", "store/icon-512.png"]) {
  const m = await sharp(at(f)).metadata();
  console.log(`${f}: ${m.width} x ${m.height}`);
}

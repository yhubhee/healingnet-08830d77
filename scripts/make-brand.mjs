// Builds every logo and icon, for the website and the app, from the HealingNet logo
// (scripts/brand/healingnet-logo.png: the teal "H" mark with the name beside it).
// The logo is not redrawn: the white background is made transparent and the mark is cut out.
//
//   Website
//     public/logo.png                 the full logo (mark + name), transparent
//     public/images/logo-mark.png     the mark on a white rounded tile (headers, dashboards)
//     src/assets/healingnet-logo.png  the same tile (hospital and admin sidebars)
//     public/favicon.svg, favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png
//   App
//     mobile/assets/icon.png                1024, the mark on white
//     mobile/assets/adaptive-foreground.png 1024, the mark inside Android's safe zone
//     mobile/assets/splash-icon.png         the mark, for the white splash screen
//     mobile/assets/logo.png                the tile, for the welcome and loading screens
//
// Usage: node scripts/make-brand.mjs   (then node scripts/make-og.mjs for the sharing image)
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const at = (...p) => path.join(root, ...p);
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };
const png = { compressionLevel: 9 };

// 1. White background -> transparent, keeping the soft edges.
const { data, info } = await sharp(at("scripts/brand/healingnet-logo.png")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const px = info.width * info.height;
// The logo's own teal: the darkest common colour.
let tr = 0, tg = 0, tb = 0, n = 0;
for (let i = 0; i < px; i++) {
  const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
  if (data[i * 4 + 3] > 250 && r < 40 && g < 130) { tr += r; tg += g; tb += b; n++; }
}
const teal = n ? [Math.round(tr / n), Math.round(tg / n), Math.round(tb / n)] : [6, 95, 96];
for (let i = 0; i < px; i++) {
  const r = data[i * 4];
  const cover = Math.max(0, Math.min(1, (255 - r) / (255 - teal[0])));
  data[i * 4] = teal[0]; data[i * 4 + 1] = teal[1]; data[i * 4 + 2] = teal[2];
  data[i * 4 + 3] = Math.round(cover * data[i * 4 + 3]);
}
const clean = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();

// 2. The full logo and the mark (the mark is the left quarter of the picture).
const full = await sharp(clean).trim().png(png).toBuffer();
const mark = await sharp(await sharp(clean).extract({ left: 0, top: 0, width: Math.round(info.width * 0.24), height: info.height }).toBuffer()).trim().png().toBuffer();

/** The mark centred on a square. `fill` is how much of the square the mark covers. */
async function square(size, background, fill, radius = 0) {
  const inner = Math.round(size * fill);
  const m = await sharp(mark).resize(inner, inner, { fit: "contain", background: CLEAR }).toBuffer();
  const base = radius
    ? sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${Math.round(size * radius)}" fill="${background}"/></svg>`))
    : sharp({ create: { width: size, height: size, channels: 4, background } });
  return base.composite([{ input: m, gravity: "center" }]).png(png).toBuffer();
}
/** The mark on a white rounded tile: readable on light and dark pages alike. */
const tile = (size) => square(size, "#ffffff", 0.7, 0.22);

// 3. Website.
await writeFile(at("public/logo.png"), full);
await writeFile(at("public/images/logo-mark.png"), await tile(96));
await writeFile(at("src/assets/healingnet-logo.png"), await tile(192));
await writeFile(at("public/apple-touch-icon.png"), await square(180, "#ffffff", 0.66));
await writeFile(at("public/icon-192.png"), await square(192, "#ffffff", 0.66));
await writeFile(at("public/icon-512.png"), await square(512, "#ffffff", 0.66));
const fav = await tile(64);
await writeFile(at("public/favicon.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 64 64" width="64" height="64"><image width="64" height="64" xlink:href="data:image/png;base64,${fav.toString("base64")}"/></svg>\n`);
// favicon.ico: one 48x48 PNG inside the .ico wrapper (every current browser reads this).
const ico48 = await tile(48);
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
header.writeUInt8(48, 6); header.writeUInt8(48, 7); header.writeUInt8(0, 8); header.writeUInt8(0, 9);
header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12); header.writeUInt32LE(ico48.length, 14); header.writeUInt32LE(22, 18);
await writeFile(at("public/favicon.ico"), Buffer.concat([header, ico48]));

// 4. App.
await writeFile(at("mobile/assets/icon.png"), await sharp(await square(1024, "#ffffff", 0.6)).flatten({ background: "#ffffff" }).png(png).toBuffer());
await writeFile(at("mobile/assets/adaptive-foreground.png"), await square(1024, CLEAR, 0.44));
await writeFile(at("mobile/assets/splash-icon.png"), await square(512, CLEAR, 0.9));
await writeFile(at("mobile/assets/logo.png"), await tile(352));

console.log(`Logo colour rgb(${teal.join(", ")}). Website and app logos and icons written.`);

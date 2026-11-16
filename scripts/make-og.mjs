// Builds the social sharing image from the HealingNet logo (scripts/brand/healingnet-logo.png):
//   public/og-image.png          1200x630 Open Graph / Twitter card
//   public/site.webmanifest
// The favicon, the icons and the header mark are made by scripts/make-brand.mjs.
//
// Usage: npm run images   (or: node scripts/make-og.mjs)
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = (...p) => path.join(root, "public", ...p);

// Marketing palette (src/index.css, .marketing).
const INK = "#112A2F";
const TEAL = "#186E6A";
const SAND = "#F4EFE6";
const OFFWHITE = "#FBFAF7";
const CORAL = "#EE6C4D";

// The "H" mark, cut from the HealingNet logo (the same way scripts/make-brand.mjs does it,
// which also writes the favicon, the icons and the header mark).
const { data, info } = await sharp(path.join(root, "scripts/brand/healingnet-logo.png")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
for (let i = 0; i < info.width * info.height; i++) {
  const cover = Math.max(0, Math.min(1, (255 - data[i * 4]) / 253));
  data[i * 4] = 2; data[i * 4 + 1] = 92; data[i * 4 + 2] = 95;
  data[i * 4 + 3] = Math.round(cover * data[i * 4 + 3]);
}
const clean = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
const mark = await sharp(await sharp(clean).extract({ left: 0, top: 0, width: Math.round(info.width * 0.24), height: info.height }).toBuffer()).trim().toBuffer();

await mkdir(pub("images"), { recursive: true });

await writeFile(
  pub("site.webmanifest"),
  JSON.stringify(
    {
      name: "HealingNet",
      short_name: "HealingNet",
      description: "See a trusted doctor today, from anywhere in Nigeria.",
      start_url: "/",
      display: "standalone",
      background_color: OFFWHITE,
      theme_color: TEAL,
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    },
    null,
    2,
  ) + "\n",
);

// Open Graph image. Fonts: the marketing fonts aren't installed system-wide where this runs,
// so the SVG asks for Georgia / a sans fallback, which every build machine has.
const ogMark = await sharp(mark).resize(88, 88, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${OFFWHITE}"/>
  <rect x="880" y="0" width="320" height="630" fill="${SAND}"/>
  <circle cx="1040" cy="315" r="140" fill="${TEAL}" opacity="0.12"/>
  <circle cx="1040" cy="315" r="95" fill="${TEAL}" opacity="0.18"/>
  <circle cx="1120" cy="200" r="14" fill="${CORAL}"/>
  <text x="196" y="138" font-family="Segoe UI, Arial, sans-serif" font-size="40" font-weight="700" fill="${INK}">HealingNet</text>
  <text x="80" y="290" font-family="Georgia, 'Times New Roman', serif" font-size="68" font-weight="600" fill="${INK}" letter-spacing="-1.5">See a trusted doctor</text>
  <text x="80" y="372" font-family="Georgia, 'Times New Roman', serif" font-size="68" font-weight="600" fill="${INK}" letter-spacing="-1.5">today, from anywhere.</text>
  <text x="80" y="460" font-family="Segoe UI, Arial, sans-serif" font-size="30" fill="${TEAL}">Video and in-person visits · Pay in naira · Free for patients</text>
  <rect x="80" y="520" width="120" height="6" rx="3" fill="${TEAL}"/>
</svg>`;
await sharp(Buffer.from(og))
  .composite([
    { input: ogMark, left: 90, top: 70 },
    { input: await sharp(mark).resize(130, 130, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(), left: 975, top: 250 },
  ])
  .png({ compressionLevel: 9 })
  .toFile(pub("og-image.png"));

console.log("og-image.png and site.webmanifest written.");

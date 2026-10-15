// Builds the social sharing image and the icons from public/logo.png (the logo is not redesigned,
// only the cross mark is cropped out of it):
//   public/og-image.png          1200x630 Open Graph / Twitter card
//   public/favicon.svg           the cross mark, wrapped in SVG
//   public/apple-touch-icon.png  180x180
//   public/icon-192.png, public/icon-512.png + public/site.webmanifest
//   public/images/logo-mark.png  96x96 mark for the website header
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

// The cross mark sits in the top half of the 512x512 logo, above the wordmark.
const markArea = await sharp(pub("logo.png")).extract({ left: 170, top: 120, width: 175, height: 175 }).toBuffer();
const mark = await sharp(markArea).trim().toBuffer();

/** The mark centred on a square background with some breathing room. */
async function squareIcon(size, background, padding = 0.18) {
  const inner = Math.round(size * (1 - padding * 2));
  const resized = await sharp(mark).resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: resized, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

await mkdir(pub("images"), { recursive: true });

// Header mark (transparent).
await sharp(mark).resize(96, 96, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 9 }).toFile(pub("images/logo-mark.png"));

// Icons.
await writeFile(pub("apple-touch-icon.png"), await squareIcon(180, "#ffffff"));
await writeFile(pub("icon-192.png"), await squareIcon(192, "#ffffff"));
await writeFile(pub("icon-512.png"), await squareIcon(512, "#ffffff"));

const favPng = await sharp(mark).resize(64, 64, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 9 }).toBuffer();
await writeFile(
  pub("favicon.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 64 64" width="64" height="64"><image width="64" height="64" xlink:href="data:image/png;base64,${favPng.toString("base64")}"/></svg>\n`,
);

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

console.log("og-image.png, favicon.svg, apple-touch-icon.png, icon-192/512.png, site.webmanifest, images/logo-mark.png written.");

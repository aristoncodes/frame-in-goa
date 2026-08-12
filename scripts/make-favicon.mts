/**
 * Builds the site icons from the sun mark in web/.
 *
 * Next's App Router picks these up by filename — app/favicon.ico, app/icon.png
 * and app/apple-icon.png are wired into <head> automatically, so nothing here
 * needs a matching entry in layout.tsx.
 *
 * The .ico is packed by hand: an ICO is a 6-byte header, one 16-byte directory
 * entry per size, then the payloads, and every browser that matters reads PNG
 * payloads inside an ICO. That avoids pulling in an encoder dependency for one
 * file. Run: npm run favicon
 */
import { createCanvas, loadImage } from "@napi-rs/canvas";
import fs from "node:fs";
import path from "node:path";
import { COLORS } from "../lib/brand";

const root = process.cwd();
const src = (size: number) => path.join(root, "web", `icons8-sun-keek-${size}.png`);
const master = await loadImage(fs.readFileSync(src(512)));

/** Square PNG at `size`, optionally on a flat plate instead of transparency. */
function render(size: number, background?: string) {
  const c = createCanvas(size, size);
  const ctx = c.getContext("2d");
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, size, size);
    // iOS rounds the corners itself, so the mark just needs breathing room.
    const pad = Math.round(size * 0.1);
    ctx.drawImage(master, pad, pad, size - pad * 2, size - pad * 2);
  } else {
    ctx.drawImage(master, 0, 0, size, size);
  }
  return c.toBuffer("image/png");
}

/** Pack PNG payloads into a multi-resolution .ico. */
function ico(entries: { size: number; png: Buffer }[]) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);

  const dir = Buffer.alloc(16 * entries.length);
  let offset = header.length + dir.length;
  entries.forEach(({ size, png }, i) => {
    const at = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, at); // 0 means 256
    dir.writeUInt8(size >= 256 ? 0 : size, at + 1);
    dir.writeUInt8(0, at + 2); // palette count
    dir.writeUInt8(0, at + 3); // reserved
    dir.writeUInt16LE(1, at + 4); // colour planes
    dir.writeUInt16LE(32, at + 6); // bits per pixel
    dir.writeUInt32LE(png.length, at + 8);
    dir.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });

  return Buffer.concat([header, dir, ...entries.map((e) => e.png)]);
}

const out = path.join(root, "app");

// 16 and 32 are the sizes browsers actually ask a favicon for; 48 covers
// Windows' taskbar and pinned-site scaling.
const sizes = [16, 32, 48];
fs.writeFileSync(
  path.join(out, "favicon.ico"),
  ico(sizes.map((size) => ({ size, png: render(size) }))),
);

// Standalone PNG icon for browsers and Android home screens.
fs.writeFileSync(path.join(out, "icon.png"), render(192));

// Apple strips alpha and composites on black, so this one gets the brand plate.
fs.writeFileSync(path.join(out, "apple-icon.png"), render(180, COLORS.green));

console.log(`favicon.ico  ${sizes.join(", ")}px`);
console.log("icon.png     192px");
console.log("apple-icon.png  180px on", COLORS.green);

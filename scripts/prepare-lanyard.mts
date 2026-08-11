/**
 * Turns a photo of the lanyard on a white background into a transparent PNG the
 * poster can composite.
 *
 * Usage: npm run brand:lanyard -- <path-to-image>
 *
 * Knocks out near-white pixels, feathers the last stop so chrome edges don't
 * come out jagged, then trims to the artwork's bounds so it scales predictably.
 */
import { loadImage, createCanvas } from "@napi-rs/canvas";
import fs from "node:fs";
import path from "node:path";

const src = process.argv[2];
if (!src || !fs.existsSync(src)) {
  console.error("Pass the image: npm run brand:lanyard -- ./lanyard.png");
  process.exit(1);
}

const img = await loadImage(fs.readFileSync(src));
const c = createCanvas(img.width, img.height);
const ctx = c.getContext("2d");
ctx.drawImage(img, 0, 0);

const id = ctx.getImageData(0, 0, img.width, img.height);
const d = id.data;

/** Fully clear above this, fully keep below it, ramp between. */
const CLEAR = 250;
const KEEP = 228;

let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1;
for (let i = 0; i < d.length; i += 4) {
  const min = Math.min(d[i], d[i + 1], d[i + 2]);
  const max = Math.max(d[i], d[i + 1], d[i + 2]);
  // White is bright and unsaturated; chrome highlights are bright but sit next
  // to dark neighbours, so saturation alone can't be the test.
  const neutral = max - min < 14;
  let a = 255;
  if (neutral && min >= CLEAR) a = 0;
  else if (neutral && min > KEEP) a = Math.round(((CLEAR - min) / (CLEAR - KEEP)) * 255);
  d[i + 3] = Math.min(d[i + 3], a);
  if (d[i + 3] > 8) {
    const p = i / 4;
    const x = p % img.width;
    const y = (p / img.width) | 0;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
}
ctx.putImageData(id, 0, 0);

const tw = Math.max(1, x1 - x0 + 1);
const th = Math.max(1, y1 - y0 + 1);
const out = createCanvas(tw, th);
out.getContext("2d").drawImage(c, -x0, -y0);

const dest = path.join(process.cwd(), "public", "brand", "lanyard.png");
fs.writeFileSync(dest, out.toBuffer("image/png"));
console.log(`lanyard.png  ${img.width}x${img.height} → trimmed ${tw}x${th}`);
console.log("Now set NEXT_PUBLIC_LANYARD_URL=/brand/lanyard.png");

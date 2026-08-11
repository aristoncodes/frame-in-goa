/**
 * Invariant: the card is ONE size. Measures the kraft card's bounding box in
 * every rendered poster and fails if any two differ.
 */
import { loadImage, createCanvas } from "@napi-rs/canvas";
import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "scripts", "out");
const files = fs.readdirSync(dir).filter((f) => /^(front|back|name|tone|user)-?.*\.png$/.test(f));

const isKraft = (r: number, g: number, b: number) =>
  r > 185 && r < 240 && g > 170 && g < 220 && b > 135 && b < 195 && r > b + 30;

const boxes: Record<string, string> = {};
for (const f of files) {
  const img = await loadImage(fs.readFileSync(path.join(dir, f)));
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, img.width, img.height);
  // Only rows that are mostly kraft count as card rows; scattered kraft-ish
  // pixels elsewhere in the poster must not widen the measured box.
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < img.height; y++) {
    let rowMin = 1e9, rowMax = -1, count = 0;
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      if (isKraft(data[i], data[i + 1], data[i + 2])) {
        count++;
        if (x < rowMin) rowMin = x;
        if (x > rowMax) rowMax = x;
      }
    }
    if (count < 300) continue;
    if (rowMin < x0) x0 = rowMin;
    if (rowMax > x1) x1 = rowMax;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  boxes[f] = `${x0},${y0} ${x1 - x0 + 1}x${y1 - y0 + 1}`;
}

const seen = new Map<string, string[]>();
for (const [f, b] of Object.entries(boxes)) seen.set(b, [...(seen.get(b) ?? []), f]);

for (const [box, fs_] of seen) console.log(`${box.padEnd(24)} ${fs_.length} file(s): ${fs_.join(", ")}`);
if (seen.size === 1) {
  console.log("\nPASS  card renders at exactly one size across all cases");
} else {
  console.log(`\nFAIL  card size varies across ${seen.size} distinct boxes`);
  process.exit(1);
}

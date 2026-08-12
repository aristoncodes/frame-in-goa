/**
 * Invariant: the card is ONE size, on both faces and in both crops.
 *
 * Measured two ways, because the two faces are printed on different stock and no
 * single colour test sees both:
 *
 * - **posters** — the kraft front card's bounding box inside the full composite,
 *   which also pins down where the card sits on the poster. The back is green on
 *   green there, so a colour test can't find it; that is what the second group is
 *   for rather than a looser matcher that would start catching poster pixels.
 * - **card-only crops** — the fully opaque region of the transparent-ground
 *   export, which needs no colour test at all and so works on either face.
 *
 * Both groups must be internally consistent, and the card's width and height must
 * agree between them.
 */
import { loadImage, createCanvas } from "@napi-rs/canvas";
import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "scripts", "out");
const all = fs.readdirSync(dir);

const isKraft = (r: number, g: number, b: number) =>
  r > 185 && r < 240 && g > 170 && g < 220 && b > 135 && b < 195 && r > b + 30;

type Box = { x: number; y: number; w: number; h: number };

/** Bounding box of the rows that are *mostly* card, by whichever test applies. */
async function measure(file: string, hit: (d: Uint8ClampedArray, i: number) => boolean) {
  const img = await loadImage(fs.readFileSync(path.join(dir, file)));
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, img.width, img.height);
  let x0 = 1e9,
    y0 = 1e9,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < img.height; y++) {
    let rowMin = 1e9,
      rowMax = -1,
      count = 0;
    for (let x = 0; x < img.width; x++) {
      if (!hit(data, (y * img.width + x) * 4)) continue;
      count++;
      if (x < rowMin) rowMin = x;
      if (x > rowMax) rowMax = x;
    }
    // Scattered card-ish pixels elsewhere in the poster must not widen the box.
    if (count < 300) continue;
    if (rowMin < x0) x0 = rowMin;
    if (rowMax > x1) x1 = rowMax;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  if (x1 < 0) return null;
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } satisfies Box;
}

const groups: { label: string; files: string[]; boxes: Record<string, Box> }[] = [
  {
    label: "poster (kraft front)",
    files: all.filter((f) => /^(front|name|tone|user)-?.*\.png$/.test(f)),
    boxes: {},
  },
  {
    label: "card-only crop (both faces)",
    files: all.filter((f) => /^cardonly-.*\.png$/.test(f)),
    boxes: {},
  },
];

let failed = false;

for (const g of groups) {
  if (!g.files.length) {
    console.log(`\n${g.label}: no files — run npm run preview first`);
    failed = true;
    continue;
  }
  for (const f of g.files) {
    const box = await measure(
      f,
      g.label.startsWith("poster")
        ? (d, i) => isKraft(d[i], d[i + 1], d[i + 2])
        // Fully opaque only: the card body is 255 while its drop shadow peaks
        // around 115, and counting the shadow measured a box ~30px too big.
        : (d, i) => d[i + 3] > 250,
    );
    if (!box) {
      console.log(`  ${f}: no card found`);
      failed = true;
      continue;
    }
    g.boxes[f] = box;
  }

  const seen = new Map<string, string[]>();
  for (const [f, b] of Object.entries(g.boxes)) {
    const key = `${b.x},${b.y} ${b.w}x${b.h}`;
    seen.set(key, [...(seen.get(key) ?? []), f]);
  }
  console.log(`\n${g.label}`);
  for (const [box, fs_] of seen) {
    console.log(`  ${box.padEnd(24)} ${fs_.length} file(s): ${fs_.join(", ")}`);
  }
  if (seen.size !== 1) {
    console.log(`  FAIL  varies across ${seen.size} distinct boxes`);
    failed = true;
  }
}

// The card's own dimensions must agree between the poster and the tight crop.
const sizes = groups
  .map((g) => Object.values(g.boxes)[0])
  .filter(Boolean)
  .map((b) => `${b.w}x${b.h}`);
const agree = new Set(sizes).size === 1;
console.log(`\ncard size across crops: ${sizes.join(" vs ")} → ${agree ? "agree" : "DISAGREE"}`);
if (!agree) failed = true;

console.log(
  failed
    ? "\nFAIL  card size is not consistent"
    : "\nPASS  card renders at exactly one size across every face and crop",
);
process.exit(failed ? 1 : 0);

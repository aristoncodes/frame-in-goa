/**
 * Rasterises the official SVG marks to high-resolution PNGs.
 *
 * Renderers draw these far larger than the SVGs' intrinsic size, and both
 * resvg and some browsers rasterise an SVG at its declared size before scaling,
 * which would soften the edges. Bumping width/height first keeps them sharp.
 */
import { loadImage, createCanvas } from "@napi-rs/canvas";
import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "public", "brand");

for (const [src, out, scale] of [
  ["goa_hindi.svg", "goa-hindi.png", 6],
  ["2-47.svg", "studio-247.png", 4],
] as const) {
  const svg = fs.readFileSync(path.join(dir, src), "utf8");
  const w = Number(svg.match(/width="([\d.]+)"/)?.[1] ?? 200);
  const h = Number(svg.match(/height="([\d.]+)"/)?.[1] ?? 200);
  // Enlarging width/height only scales the artwork if a viewBox maps the old
  // coordinate space onto the new size; without one the mark is merely padded.
  let big = svg
    .replace(/width="[\d.]+"/, `width="${Math.round(w * scale)}"`)
    .replace(/height="[\d.]+"/, `height="${Math.round(h * scale)}"`);
  if (!/viewBox=/.test(big)) {
    big = big.replace(/<svg /, `<svg viewBox="0 0 ${w} ${h}" `);
  }
  const img = await loadImage(Buffer.from(big));
  const full = createCanvas(img.width, img.height);
  const fctx = full.getContext("2d");
  fctx.drawImage(img, 0, 0);

  // Trim transparent margins. The source marks carry a lot of empty space, and
  // scaling by height would otherwise render the glyphs a fraction of their box.
  const { data } = fctx.getImageData(0, 0, img.width, img.height);
  let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (data[(y * img.width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  const tw = Math.max(1, x1 - x0 + 1);
  const th = Math.max(1, y1 - y0 + 1);
  const c = createCanvas(tw, th);
  c.getContext("2d").drawImage(full, -x0, -y0);
  fs.writeFileSync(path.join(dir, out), c.toBuffer("image/png"));
  console.log(`${out}  ${img.width}x${img.height} → trimmed ${tw}x${th}`);
}

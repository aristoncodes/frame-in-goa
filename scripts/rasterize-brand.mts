/**
 * Rasterises the official SVG marks to high-resolution PNGs.
 *
 * Two reasons the canvas renderers can't just draw the SVGs directly:
 *
 * 1. They draw the marks far larger than the SVGs' intrinsic size, and some
 *    browsers rasterise an SVG image at its declared size before scaling it,
 *    which softens the edges.
 * 2. goa_hindi.svg is a Figma outside-stroke export — gold glyphs plus a second
 *    masked pass that paints the pink sticker outline. resvg (what @napi-rs/canvas
 *    uses) mis-renders that mask, so rasterising happens in Chromium instead,
 *    which reproduces the mark exactly as hhgoa.com shows it.
 *
 * The artwork's own colours are kept: nothing here recolours a brand mark.
 * Run: npm run brand
 */
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "public", "brand");

const browser = await chromium.launch();

/**
 * `trim` crops transparent margins away. Marks want it — their SVGs carry a lot
 * of empty box and scaling by height would otherwise render the glyphs a
 * fraction of their size. The lanyard must not be trimmed: the renderers place
 * it by its eyelet's coordinate inside the original viewBox, and cropping the
 * box moves that point.
 */
for (const [src, out, scale, trim] of [
  ["goa_hindi.svg", "goa-hindi.png", 6, true],
  ["2-47.svg", "studio-247.png", 4, true],
  ["lanyard.svg", "lanyard.png", 3, false],
  ["back-lockup.svg", "back-lockup.png", 6, true],
] as const) {
  const svg = fs.readFileSync(path.join(dir, src), "utf8");
  const w = Number(svg.match(/width="([\d.]+)"/)?.[1] ?? 200);
  const h = Number(svg.match(/height="([\d.]+)"/)?.[1] ?? 200);
  const tw = Math.round(w * scale);
  const th = Math.round(h * scale);

  const page = await browser.newPage({
    viewport: { width: tw, height: th },
    deviceScaleFactor: 1,
  });
  // Inlined rather than loaded from file:// so the SVG's own markup renders
  // as a document element — an <img> off file:// is blocked from a data: page.
  await page.setContent(
    `<body style="margin:0;background:transparent">${svg
      .replace(/width="[\d.]+"/, `width="${tw}"`)
      .replace(/height="[\d.]+"/, `height="${th}"`)}</body>`,
  );
  const shot = await page.screenshot({ omitBackground: true });
  await page.close();

  const img = await loadImage(shot);
  const full = createCanvas(img.width, img.height);
  const fctx = full.getContext("2d");
  fctx.drawImage(img, 0, 0);

  if (!trim) {
    fs.writeFileSync(path.join(dir, out), full.toBuffer("image/png"));
    console.log(`${out}  ${img.width}x${img.height} (untrimmed)`);
    continue;
  }

  // Trim transparent margins. The source marks carry a lot of empty space, and
  // scaling by height would otherwise render the glyphs a fraction of their box.
  const { data } = fctx.getImageData(0, 0, img.width, img.height);
  let x0 = img.width,
    y0 = img.height,
    x1 = -1,
    y1 = -1;
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
  const cw = Math.max(1, x1 - x0 + 1);
  const ch = Math.max(1, y1 - y0 + 1);
  const c = createCanvas(cw, ch);
  c.getContext("2d").drawImage(full, -x0, -y0);

  fs.writeFileSync(path.join(dir, out), c.toBuffer("image/png"));
  console.log(`${out}  ${img.width}x${img.height} → trimmed ${cw}x${ch}`);
}

await browser.close();

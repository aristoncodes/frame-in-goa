import { COLORS, FONTS } from "../brand";

/**
 * A minimal structural type covering both the browser's CanvasRenderingContext2D
 * and @napi-rs/canvas's context, so every renderer runs unchanged in the browser
 * and in the Node preview script.
 */
export type Ctx = CanvasRenderingContext2D;

/* ------------------------------------------------------------------ shapes */

export function roundRect(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/**
 * Irregular n-point starburst. `seed` drives the deterministic jitter so a given
 * burst looks hand-cut but renders identically every time.
 */
export function starburst(
  ctx: Ctx,
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  points: number,
  rotation = 0,
  seed = 1,
) {
  const rnd = mulberry(seed);
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const isOuter = i % 2 === 0;
    const jitter = 1 + (rnd() - 0.5) * (isOuter ? 0.26 : 0.16);
    const r = (isOuter ? outer : inner) * jitter;
    const a = rotation + (Math.PI * i) / points + (rnd() - 0.5) * 0.09;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** Loose hand-drawn squiggle running left→right through a set of wave nodes. */
export function squiggle(
  ctx: Ctx,
  x: number,
  y: number,
  width: number,
  amplitude: number,
  waves: number,
  lineWidth: number,
  color: string,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);
  const step = width / waves;
  for (let i = 0; i < waves; i++) {
    const dir = i % 2 === 0 ? -1 : 1;
    ctx.bezierCurveTo(
      x + step * i + step * 0.25,
      y + amplitude * dir * 1.35,
      x + step * i + step * 0.75,
      y + amplitude * dir * 1.35,
      x + step * (i + 1),
      y,
    );
  }
  ctx.stroke();
  ctx.restore();
}

/* ------------------------------------------------------------------- paper */

/** Deterministic PRNG so grain/jitter is stable across renders and machines. */
export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Speckled paper grain. Drawn as tiny translucent rects rather than per-pixel
 * ImageData so it stays fast at 1080px on a phone.
 */
export function grain(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  density = 0.00055,
  seed = 7,
  light = "rgba(255,255,255,0.05)",
  dark = "rgba(0,0,0,0.06)",
) {
  const rnd = mulberry(seed);
  const count = Math.floor(w * h * density);
  ctx.save();
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = rnd() > 0.5 ? light : dark;
    const s = 1 + rnd() * 2.2;
    ctx.fillRect(x + rnd() * w, y + rnd() * h, s, s);
  }
  ctx.restore();
}

/* -------------------------------------------------------------------- text */

export function font(family: string, size: number, weight: number | string = 400) {
  return `${weight} ${size}px "${family}"`;
}

/** Draw text with manual letter-spacing (Safari lacks ctx.letterSpacing). */
export function trackedText(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  tracking: number,
  align: "left" | "center" | "right" = "left",
) {
  const chars = [...text];
  const total =
    chars.reduce((sum, c) => sum + ctx.measureText(c).width, 0) +
    tracking * Math.max(0, chars.length - 1);
  let cx = align === "left" ? x : align === "center" ? x - total / 2 : x - total;
  const prev = ctx.textAlign;
  ctx.textAlign = "left";
  for (const c of chars) {
    ctx.fillText(c, cx, y);
    cx += ctx.measureText(c).width + tracking;
  }
  ctx.textAlign = prev;
  return total;
}

export function trackedWidth(ctx: Ctx, text: string, tracking: number) {
  const chars = [...text];
  return (
    chars.reduce((s, c) => s + ctx.measureText(c).width, 0) +
    tracking * Math.max(0, chars.length - 1)
  );
}

/**
 * Largest size ≤ `max` at which `text` fits `maxWidth`. Every user-supplied
 * string goes through this, so long names can never overflow the card.
 */
export function fitFontSize(
  ctx: Ctx,
  text: string,
  family: string,
  weight: number | string,
  max: number,
  min: number,
  maxWidth: number,
  tracking = 0,
) {
  let size = max;
  while (size > min) {
    ctx.font = font(family, size, weight);
    if (trackedWidth(ctx, text, tracking) <= maxWidth) break;
    size -= 1;
  }
  ctx.font = font(family, size, weight);
  return size;
}

/** Draw text clipped to `maxWidth`, appending an ellipsis when it must cut. */
export function ellipsize(ctx: Ctx, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) t = t.slice(0, -1);
  return t + "…";
}

/* -------------------------------------------------------- signature motifs */

/**
 * The pink "गोवा" sticker badge — the single most recognisable HH Goa asset.
 * Reused in both generator outputs. Drawn as offset stroke passes to fake the
 * spray-paint sticker outline seen in the brand artwork.
 */
export function devaBadge(
  ctx: Ctx,
  cx: number,
  cy: number,
  size: number,
  opts: { rotate?: number; glow?: boolean; plate?: boolean } = {},
) {
  const { rotate = -0.09, glow = true, plate = false } = opts;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotate);
  ctx.font = font(FONTS.deva, size, 400);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const w = ctx.measureText("गोवा").width;

  if (plate) {
    ctx.save();
    ctx.fillStyle = COLORS.pink;
    roundRect(ctx, -w / 2 - size * 0.3, -size * 0.72, w + size * 0.6, size * 1.42, size * 0.3);
    ctx.fill();
    ctx.strokeStyle = COLORS.cream;
    ctx.lineWidth = Math.max(2, size * 0.05);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = COLORS.gold;
    ctx.fillText("गोवा", 0, size * 0.06);
    ctx.restore();
    return;
  }

  if (glow) {
    ctx.save();
    ctx.shadowColor = "rgba(230,25,122,0.85)";
    ctx.shadowBlur = size * 0.42;
    ctx.fillStyle = COLORS.pink;
    ctx.fillText("गोवा", 0, 0);
    ctx.fillText("गोवा", 0, 0);
    ctx.restore();
  }
  // sticker outline: dark offset then flat pink face
  ctx.fillStyle = COLORS.pinkDeep;
  ctx.fillText("गोवा", size * 0.035, size * 0.045);
  ctx.fillStyle = COLORS.pink;
  ctx.fillText("गोवा", 0, 0);
  ctx.restore();
}

/* ------------------------------------------------------------------ images */

/**
 * Cover-fit an image into a rect (like CSS object-fit: cover) with a normalised
 * focal point + zoom, so portrait, landscape and off-centre photos all land
 * sensibly without the user needing to pre-crop.
 */
export function drawCover(
  ctx: Ctx,
  img: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number,
  transform: { zoom: number; offsetX: number; offsetY: number } = {
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
  },
) {
  const iw = (img as HTMLImageElement).width;
  const ih = (img as HTMLImageElement).height;
  const base = Math.max(w / iw, h / ih);
  const scale = base * transform.zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  // offsets are fractions of the overflow, clamped so the frame never shows gaps
  const maxDX = Math.max(0, (dw - w) / 2);
  const maxDY = Math.max(0, (dh - h) / 2);
  const dx = x + (w - dw) / 2 + clamp(transform.offsetX, -1, 1) * maxDX;
  const dy = y + (h - dh) / 2 + clamp(transform.offsetY, -1, 1) * maxDY;
  ctx.drawImage(img, dx, dy, dw, dh);
}

export function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

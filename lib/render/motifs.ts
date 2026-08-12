import JsBarcode from "jsbarcode";
import { COLORS, EVENT, FONTS } from "../brand";
import {
  addRoundRect,
  Ctx,
  devaBadge,
  fitFontSize,
  font,
  grain,
  mulberry,
  roundRect,
  starburst,
  trackedText,
} from "./primitives";

/**
 * Environment shim: the renderers need to make throwaway canvases (barcode,
 * texture buffers) without knowing whether they run in a browser or in Node.
 */
export type RenderEnv = {
  createCanvas: (w: number, h: number) => { canvas: CanvasImageSource; ctx: Ctx };
};

/* --------------------------------------------------------- poster backdrop */

/** Full-bleed green field with paper grain and a soft vignette. */
export function posterBackground(ctx: Ctx, w: number, h: number) {
  ctx.fillStyle = COLORS.green;
  ctx.fillRect(0, 0, w, h);

  const vig = ctx.createRadialGradient(w / 2, h * 0.42, w * 0.1, w / 2, h * 0.5, w * 0.85);
  vig.addColorStop(0, "rgba(26,107,68,0.55)");
  vig.addColorStop(1, "rgba(8,52,32,0.55)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  grain(ctx, 0, 0, w, h, 0.0006, 91, "rgba(255,255,255,0.045)", "rgba(0,0,0,0.07)");
}

/**
 * The mirrored oversized headline: "HACKER HOUSE" cropped by the top edge with
 * "HOUSE HACKER" beneath it, both in gold display serif, low z-index.
 */
export function mirroredHeadline(ctx: Ctx, w: number, opts: { top?: number } = {}) {
  const top = opts.top ?? 0;
  const lines = ["HACKER HOUSE", "HOUSE HACKER"];
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = COLORS.gold;

  // Sized so a line spans the full canvas width; positioned so the caps are
  // whole rather than sliced by the top edge.
  let size = 200;
  ctx.font = font(FONTS.display, size, 500);
  size = Math.round((size * (w * 1.02)) / ctx.measureText(lines[0]).width);

  const lineH = size * 0.9;
  lines.forEach((line, i) => {
    ctx.font = font(FONTS.display, size, 500);
    ctx.globalAlpha = 0.82;
    ctx.fillText(line, w / 2, top + size * 0.86 + i * lineH);
  });
  ctx.restore();
}

/** "GOA 2026" running along the bottom edge, partially occluded by the card. */
export function bottomWordmark(ctx: Ctx, w: number, h: number) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = COLORS.gold;
  let size = 200;
  ctx.font = font(FONTS.display, size, 500);
  size = Math.round((size * (w * 0.96)) / ctx.measureText("GOA 2026").width);
  ctx.font = font(FONTS.display, size, 500);
  ctx.globalAlpha = 0.9;
  ctx.fillText("GOA 2026", w / 2, h - size * 0.12);
  ctx.restore();
}

/** Starbursts, the गोवा sticker and the pink squiggle scattered behind the card. */
export function decorations(
  ctx: Ctx,
  w: number,
  h: number,
  layout: {
    yellowBurst: [number, number, number];
    pinkBurst: [number, number, number];
    squiggle: [number, number, number];
    deva: [number, number, number];
  },
  goaMark: CanvasImageSource | null = null,
) {
  const [yx, yy, yr] = layout.yellowBurst;
  ctx.save();
  ctx.fillStyle = COLORS.gold;
  starburst(ctx, yx, yy, yr, yr * 0.32, 9, 0.35, 12);
  ctx.fill();
  ctx.restore();

  const [sx, sy, sw] = layout.squiggle;
  loopySquiggle(ctx, sx, sy, sw, Math.max(3.5, w * 0.0055), COLORS.pink);

  const [dx, dy, ds] = layout.deva;
  devaBadge(ctx, dx, dy, ds, { rotate: -0.07, glow: true, image: goaMark });

  const [px, py, pr] = layout.pinkBurst;
  ctx.save();
  ctx.fillStyle = COLORS.pink;
  starburst(ctx, px, py, pr, pr * 0.36, 8, 0.2, 5);
  ctx.fill();
  ctx.restore();
}

/**
 * A loose ribbon that dips, loops back on itself and trails off — closer to the
 * hand-drawn accent in the brand artwork than an even sine wave.
 */
export function loopySquiggle(
  ctx: Ctx,
  x: number,
  y: number,
  width: number,
  lineWidth: number,
  color: string,
) {
  const u = width / 100;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.bezierCurveTo(x + 14 * u, y - 22 * u, x + 34 * u, y - 20 * u, x + 40 * u, y + 2 * u);
  ctx.bezierCurveTo(x + 45 * u, y + 20 * u, x + 26 * u, y + 30 * u, x + 20 * u, y + 16 * u);
  ctx.bezierCurveTo(x + 15 * u, y + 4 * u, x + 34 * u, y - 4 * u, x + 52 * u, y + 6 * u);
  ctx.bezierCurveTo(x + 72 * u, y + 17 * u, x + 86 * u, y + 6 * u, x + 100 * u, y - 8 * u);
  ctx.stroke();
  ctx.restore();
}

/* ----------------------------------------------------------------- lanyard */

/**
 * The circular opening in the card that the grommet seats in. The card and the
 * lanyard both read it from `cardLayout`, so the ring can never drift off the
 * hole it is meant to be reinforcing.
 */
export type Punch = { cx: number; cy: number; r: number };

/**
 * Strap width, and the outer edge of the grommet's flange. Kept close together
 * on purpose: a ring much narrower than the webbing leaves the tail's flat
 * bottom edge hanging over bare kraft, and the two read as separate objects
 * rather than as a strap feeding into a ring.
 */
const STRAP_W = 88;
const EYELET_R = 38;
/** Centre line of the buckle: roughly two thirds of the way down the run. */
const BUCKLE_Y = 292;
/** Inset of the stitch line from the webbing's edge. */
const STITCH_INSET = 8;

/**
 * Printed webbing hung from the poster's top edge, through a D-ring, down to a
 * grommet set in the card's punch hole.
 *
 * Four flat pieces, back to front: upper strap, tail, buckle over the join, then
 * the eyelet. Nothing goes behind the card — the ring is the only part that
 * touches it, seated in the hole the way a real grommet reinforces one. The
 * whole assembly is one component and is drawn over whichever face is showing,
 * so flipping the card never moves it.
 */
export function lanyard(ctx: Ctx, punch: Punch) {
  const cx = punch.cx;
  const x = cx - STRAP_W / 2;
  // The tail runs down to the top of the *opening* — far enough that the flange
  // covers its last ~18px, so the webbing reads as feeding into the ring, but
  // not so far that pink shows through the hole itself.
  const tailBottom = punch.cy - punch.r - 1;

  // 1. upper strap, cut off by the poster's top edge
  webbing(ctx, x, -10, STRAP_W, BUCKLE_Y + 14 - -10, (bx, by, bw, bh) =>
    stampPattern(ctx, bx, by, bw, bh),
  );

  // 3. tail below the buckle
  webbing(ctx, x, BUCKLE_Y - 10, STRAP_W, tailBottom - (BUCKLE_Y - 10), (bx, by, bw, bh) =>
    tailMarks(ctx, bx, by, bw, bh),
  );

  // 2. the D-ring, last of the three so it covers the join between them
  dRing(ctx, cx, BUCKLE_Y);

  // 4. the grommet
  eyelet(ctx, punch);
}

/**
 * One panel of pink webbing: flat fill, then a dashed gold stitch line just
 * inside each edge. `content` draws the print, clipped to the panel.
 */
function webbing(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  content: (x: number, y: number, w: number, h: number) => void,
) {
  ctx.save();
  ctx.fillStyle = COLORS.pink;
  ctx.fillRect(x, y, w, h);

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  content(x, y, w, h);
  ctx.restore();

  // stitching, drawn over the print the way it would be sewn through it
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 5]);
  ctx.beginPath();
  ctx.moveTo(x + STITCH_INSET, y);
  ctx.lineTo(x + STITCH_INSET, y + h);
  ctx.moveTo(x + w - STITCH_INSET, y);
  ctx.lineTo(x + w - STITCH_INSET, y + h);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/**
 * The repeating stamp print down the upper strap: two strings tiled at
 * alternating angles — one a shallow diagonal, the next close to vertical — with
 * deterministic jitter on angle and offset so the tiling reads as printed webbing
 * rather than as a ruled list.
 */
function stampPattern(ctx: Ctx, x: number, y: number, w: number, h: number) {
  const rnd = mulberry(23);
  const lines = ["HACKER HOUSE GOA 2026", "HACKER BUILDERS"];
  const size = 11;
  const step = 34;

  ctx.save();
  ctx.fillStyle = COLORS.ink;
  ctx.globalAlpha = 0.9;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = font(FONTS.display, size, 900);

  for (let i = 0, ty = y + 16; ty < y + h; ty += step, i++) {
    const steep = i % 2 === 1;
    const angle = (steep ? -1.28 : -0.42) + (rnd() - 0.5) * 0.22;
    ctx.save();
    ctx.translate(x + w / 2 + (rnd() - 0.5) * w * 0.3, ty);
    ctx.rotate(angle);
    ctx.fillText(lines[i % lines.length], 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

/** The tail's print: an eight-point burst over "247 BUILDERS". */
function tailMarks(ctx: Ctx, x: number, y: number, w: number, h: number) {
  const cx = x + w / 2;

  ctx.save();
  ctx.fillStyle = COLORS.black;
  starburst(ctx, cx, y + h * 0.42, 15, 5.5, 8, 0.32, 9);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = COLORS.ink;
  ctx.textBaseline = "middle";
  // sets ctx.font to the largest size that still fits between the stitch lines
  fitFontSize(ctx, "247 BUILDERS", FONTS.display, 900, 16, 9, w - 26, 0.6);
  trackedText(ctx, "247 BUILDERS", cx, y + h * 0.78, 0.6, "center");
  ctx.restore();
}

/**
 * The D-ring the webbing doubles back through. Flat metal: a three-stop linear
 * ramp rather than the specular banding the old hardware used, so it sits in the
 * poster's illustration style instead of on top of it.
 */
function dRing(ctx: Ctx, cx: number, cy: number) {
  const w = STRAP_W + 18;
  const h = 46;
  const t = 9;
  const x = cx - w / 2;
  const y = cy - h / 2;

  ctx.save();
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, COLORS.silverHi);
  g.addColorStop(0.55, COLORS.silver);
  g.addColorStop(1, COLORS.silverLo);
  ctx.fillStyle = g;
  ctx.beginPath();
  addRoundRect(ctx, x, y, w, h, 14);
  addRoundRect(ctx, x + t, y + t, w - t * 2, h - t * 2, 7);
  ctx.fill("evenodd");

  ctx.strokeStyle = "rgba(20,18,16,0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  addRoundRect(ctx, x, y, w, h, 14);
  addRoundRect(ctx, x + t, y + t, w - t * 2, h - t * 2, 7);
  ctx.stroke();
  ctx.restore();
}

/**
 * The grommet: a flat ring from the hole's edge out to its flange. Drawn after
 * the card, sitting flush in the punch hole — the hole itself stays open, so
 * whatever is behind the card shows through the middle.
 */
function eyelet(ctx: Ctx, p: Punch) {
  const TAU = Math.PI * 2;
  ctx.save();
  const g = ctx.createLinearGradient(
    p.cx - EYELET_R,
    p.cy - EYELET_R,
    p.cx + EYELET_R,
    p.cy + EYELET_R,
  );
  g.addColorStop(0, COLORS.silverHi);
  g.addColorStop(0.55, COLORS.silver);
  g.addColorStop(1, COLORS.silverLo);
  ctx.fillStyle = g;

  ctx.beginPath();
  ctx.arc(p.cx, p.cy, EYELET_R, 0, TAU);
  ctx.closePath();
  ctx.moveTo(p.cx + p.r, p.cy);
  ctx.arc(p.cx, p.cy, p.r, 0, TAU, true);
  ctx.closePath();
  ctx.fill("evenodd");

  // hairlines top and bottom of the flange, for edge definition on kraft
  ctx.strokeStyle = "rgba(20,18,16,0.32)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(p.cx, p.cy, EYELET_R, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(p.cx, p.cy, p.r, 0, TAU);
  ctx.stroke();
  ctx.restore();
}
/* ------------------------------------------------------------- icon strip */

export type IconKind = "code" | "palm" | "wave" | "rocket" | "247";

/**
 * The chip column, themed to this event rather than to generic dev disciplines:
 * code, a Goa palm, the Arabian Sea, shipping, and 247 — the seat count the
 * whole residency is named for.
 */
export const ICON_ORDER: IconKind[] = ["code", "palm", "wave", "rocket", "247"];

/**
 * Vertical column of outlined discipline chips down the card's left gutter.
 * `active` (set from the user's stack) renders a chip filled rather than hollow.
 */
export function iconColumn(ctx: Ctx, x: number, y: number, size: number, gap: number) {
  ICON_ORDER.forEach((kind, i) => {
    const cy = y + i * (size + gap);
    ctx.save();
    roundRect(ctx, x, cy, size, size, size * 0.16);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = Math.max(1.5, size * 0.055);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(x + size / 2, cy + size / 2);
    ctx.strokeStyle = COLORS.ink;
    ctx.fillStyle = COLORS.ink;
    ctx.lineWidth = Math.max(2, size * 0.085);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const s = size * 0.5;
    drawIcon(ctx, kind, s);
    ctx.restore();
  });
}

function drawIcon(ctx: Ctx, kind: IconKind, s: number) {
  switch (kind) {
    case "code": {
      ctx.beginPath();
      ctx.moveTo(-s * 0.2, -s * 0.5);
      ctx.lineTo(-s * 0.62, 0);
      ctx.lineTo(-s * 0.2, s * 0.5);
      ctx.moveTo(s * 0.2, -s * 0.5);
      ctx.lineTo(s * 0.62, 0);
      ctx.lineTo(s * 0.2, s * 0.5);
      ctx.moveTo(s * 0.06, -s * 0.62);
      ctx.lineTo(-s * 0.06, s * 0.62);
      ctx.stroke();
      break;
    }
    case "palm": {
      const crown: [number, number] = [-s * 0.08, -s * 0.3];
      ctx.beginPath();
      ctx.moveTo(s * 0.3, s * 0.78);
      ctx.quadraticCurveTo(s * 0.04, s * 0.24, crown[0], crown[1]);
      ctx.stroke();
      ctx.beginPath();
      for (const [ex, ey] of [
        [-s * 0.86, -s * 0.34],
        [-s * 0.3, -s * 0.86],
        [s * 0.48, -s * 0.72],
        [s * 0.84, -s * 0.16],
      ] as const) {
        ctx.moveTo(crown[0], crown[1]);
        ctx.quadraticCurveTo((crown[0] + ex) * 0.5, ey - s * 0.34, ex, ey);
      }
      ctx.stroke();
      break;
    }
    case "wave": {
      ctx.beginPath();
      for (const y of [-s * 0.3, s * 0.3]) {
        ctx.moveTo(-s * 0.82, y);
        ctx.bezierCurveTo(-s * 0.5, y - s * 0.44, -s * 0.14, y + s * 0.44, s * 0.2, y);
        ctx.bezierCurveTo(s * 0.46, y - s * 0.32, s * 0.62, y - s * 0.2, s * 0.82, y - s * 0.12);
      }
      ctx.stroke();
      break;
    }
    case "rocket": {
      // fuselage
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.82);
      ctx.bezierCurveTo(s * 0.56, -s * 0.26, s * 0.44, s * 0.1, s * 0.34, s * 0.36);
      ctx.lineTo(-s * 0.34, s * 0.36);
      ctx.bezierCurveTo(-s * 0.44, s * 0.1, -s * 0.56, -s * 0.26, 0, -s * 0.82);
      ctx.closePath();
      ctx.stroke();
      // fins
      ctx.beginPath();
      ctx.moveTo(-s * 0.38, s * 0.0);
      ctx.lineTo(-s * 0.8, s * 0.52);
      ctx.lineTo(-s * 0.34, s * 0.36);
      ctx.moveTo(s * 0.38, s * 0.0);
      ctx.lineTo(s * 0.8, s * 0.52);
      ctx.lineTo(s * 0.34, s * 0.36);
      ctx.stroke();
      // porthole
      ctx.beginPath();
      ctx.arc(0, -s * 0.22, s * 0.17, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "247": {
      ctx.font = font(FONTS.display, s * 1.02, 900);
      ctx.fillText("247", 0, s * 0.06);
      break;
    }
  }
}

/** The same chips laid out left-to-right, for the card back. */
export function iconRow(ctx: Ctx, x: number, y: number, size: number, gap: number) {
  ICON_ORDER.forEach((kind, i) => {
    const cx = x + i * (size + gap);
    ctx.save();
    roundRect(ctx, cx, y, size, size, size * 0.16);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = Math.max(1.4, size * 0.055);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(cx + size / 2, y + size / 2);
    ctx.strokeStyle = COLORS.ink;
    ctx.fillStyle = COLORS.ink;
    ctx.lineWidth = Math.max(1.8, size * 0.085);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    drawIcon(ctx, kind, size * 0.5);
    ctx.restore();
  });
}

/* ----------------------------------------------------------------- barcode */

/**
 * Real CODE128 barcode via jsbarcode, rendered into an offscreen canvas then
 * composited. Encodes a short hash of the builder's details so every card
 * carries a distinct, authentic-looking code.
 */
export function barcode(
  ctx: Ctx,
  env: RenderEnv,
  value: string,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const { canvas, ctx: bctx } = env.createCanvas(Math.round(w * 2), Math.round(h * 2));
  try {
    JsBarcode(bctx.canvas ?? canvas, value, {
      format: "CODE128",
      width: 2,
      height: Math.round(h * 2) - 4,
      displayValue: false,
      margin: 0,
      background: "#00000000",
      lineColor: COLORS.ink,
    });
    ctx.drawImage(canvas, x, y, w, h);
  } catch {
    // Deterministic fallback bars — the card must never render a blank slot.
    ctx.save();
    ctx.fillStyle = COLORS.ink;
    let bx = x;
    let seed = 0;
    for (let i = 0; i < value.length; i++) seed = (seed * 31 + value.charCodeAt(i)) >>> 0;
    while (bx < x + w - 2) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      const bw = 1 + (seed % 4);
      if (seed % 3) ctx.fillRect(bx, y, bw, h);
      bx += bw + 1 + (seed % 3);
    }
    ctx.restore();
  }
}

/* ------------------------------------------------------------- card shell */

/** Kraft card body: grain, rounded corners, drop shadow and punch hole. */
export function cardShell(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  punch: Punch,
) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 46;
  ctx.shadowOffsetY = 22;
  ctx.fillStyle = COLORS.kraft;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  const sheen = ctx.createLinearGradient(x, y, x + w, y + h);
  sheen.addColorStop(0, "rgba(255,255,255,0.16)");
  sheen.addColorStop(0.5, "rgba(0,0,0,0)");
  sheen.addColorStop(1, "rgba(80,55,20,0.14)");
  ctx.fillStyle = sheen;
  ctx.fillRect(x, y, w, h);
  grain(ctx, x, y, w, h, 0.0016, 41, "rgba(255,255,255,0.3)", "rgba(90,64,26,0.16)");
  ctx.restore();

  // Punch hole. Round, because a grommet is — it used to be a wide slot, which
  // suited the hook that was threaded through it. The opening is filled with the
  // poster's deep green so it reads as open; the eyelet's flange lands on the
  // kraft around it afterwards.
  ctx.save();
  ctx.fillStyle = COLORS.greenDeep;
  ctx.beginPath();
  ctx.arc(punch.cx, punch.cy, punch.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(90,64,26,0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

/** The 2:47 studio mark, or its name set in type when the artwork is absent. */
export function cardFooter(
  ctx: Ctx,
  cx: number,
  y: number,
  size: number,
  mark: CanvasImageSource | null = null,
  env: RenderEnv | null = null,
) {
  if (mark && env) {
    const iw = (mark as HTMLImageElement).width;
    const ih = (mark as HTMLImageElement).height;
    const h = size * 2.4;
    const w = iw && ih ? (iw / ih) * h : h;
    // The official mark is gold, which disappears into kraft — recolour it to
    // the card's ink through an offscreen buffer.
    const tw = Math.max(1, Math.round(w));
    const th = Math.max(1, Math.round(h));
    const { canvas: buf, ctx: bctx } = env.createCanvas(tw, th);
    bctx.drawImage(mark, 0, 0, tw, th);
    bctx.globalCompositeOperation = "source-in";
    bctx.fillStyle = COLORS.inkSoft;
    bctx.fillRect(0, 0, tw, th);
    ctx.drawImage(buf, cx - w / 2, y - h * 0.82, w, h);
    return;
  }
  ctx.save();
  ctx.fillStyle = COLORS.inkSoft;
  ctx.font = font(FONTS.body, size, 600);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  trackedText(ctx, EVENT.studio, cx, y, size * 0.14, "center");
  ctx.restore();
}

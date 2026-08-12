import JsBarcode from "jsbarcode";
import { COLORS, EVENT, FONTS } from "../brand";
import {
  Ctx,
  devaBadge,
  font,
  grain,
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
 * The circular opening in the card the eyelet seats in. The card and the lanyard
 * both read it from `cardLayout`, so the ring can never drift off the hole.
 */
export type Punch = { cx: number; cy: number; r: number };

/**
 * The lanyard is one piece of supplied artwork (public/brand/lanyard.svg,
 * rasterised by `npm run brand`) rather than shapes this file draws. These are
 * the coordinates it is placed by, read straight off that file's viewBox:
 * the tape's width, and the centre and bore of the eyelet at its foot.
 */
const ART = { w: 400, h: 850, strapW: 150, eyeletX: 200, eyeletY: 740, boreR: 18 };

/** How wide the tape lands on the poster, which is what fixes the whole scale. */
const STRAP_W = 105;
const SCALE = STRAP_W / ART.strapW;

/**
 * Radius of the hole the artwork expects to sit in. `cardLayout` punches the
 * card to exactly this, so the eyelet's bore and the card's opening are the same
 * circle rather than two that happen to look similar.
 */
export const LANYARD_BORE_R = Math.round(ART.boreR * SCALE);

/**
 * Hangs the artwork from the poster's top edge with its eyelet on the punch
 * hole. Drawn over whichever card face is showing — nothing goes behind the
 * card, so flipping the card never moves it.
 *
 * The art's own top overruns the canvas, which is the intent: the tape is cut
 * off by the poster's edge rather than starting inside it.
 */
export function lanyard(ctx: Ctx, punch: Punch, art: CanvasImageSource | null) {
  if (!art) return;
  ctx.drawImage(
    art,
    punch.cx - ART.eyeletX * SCALE,
    punch.cy - ART.eyeletY * SCALE,
    ART.w * SCALE,
    ART.h * SCALE,
  );
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

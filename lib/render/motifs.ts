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
  ctx.font = font(FONTS.display, size, 900);
  size = Math.round((size * (w * 1.02)) / ctx.measureText(lines[0]).width);

  const lineH = size * 0.9;
  lines.forEach((line, i) => {
    ctx.font = font(FONTS.display, size, 900);
    ctx.globalAlpha = 0.92;
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
  ctx.font = font(FONTS.display, size, 900);
  size = Math.round((size * (w * 0.96)) / ctx.measureText("GOA 2026").width);
  ctx.font = font(FONTS.display, size, 900);
  ctx.fillText("GOA 2026", w / 2, h - size * 0.12);
  ctx.restore();
}

/** Starbursts, sparkles and the pink squiggle scattered behind the card. */
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

  sparkle(ctx, w * 0.9, h * 0.76, w * 0.028, COLORS.cream, 0.75);
  sparkle(ctx, w * 0.955, h * 0.735, w * 0.015, COLORS.cream, 0.5);
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

/** Four-point twinkle. */
export function sparkle(
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  color: string,
  alpha = 1,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.quadraticCurveTo(cx + r * 0.16, cy - r * 0.16, cx + r, cy);
  ctx.quadraticCurveTo(cx + r * 0.16, cy + r * 0.16, cx, cy + r);
  ctx.quadraticCurveTo(cx - r * 0.16, cy + r * 0.16, cx - r, cy);
  ctx.quadraticCurveTo(cx - r * 0.16, cy - r * 0.16, cx, cy - r);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* ----------------------------------------------------------------- lanyard */

/**
 * Clip geometry, shared so the assembly's drawn height and the height it is
 * seated at can never drift apart — when they did, the hook ran into the card's
 * header text.
 */
const CLIP_WEIGHT = 1.18;
/** Overall assembly height in reference units, measured at a 130px strap. */
const CLIP_UNITS = 370;
/**
 * Distance from the assembly's top to the hook's lowest point. Shorter than the
 * full height — the hook bottoms out before the box does — and seating by the
 * full height instead left the foot short of the punch slot.
 */
const CLIP_FOOT_UNITS = 358;
const clipUnit = (scale: number) => ((76 * scale) / 130) * CLIP_WEIGHT;
const clipHeight = (scale: number) => CLIP_UNITS * clipUnit(scale);
const clipFootDrop = (scale: number) => CLIP_FOOT_UNITS * clipUnit(scale);

/**
 * Pink strap from the top edge + black starburst rivet + silver swivel hook,
 * ending just above `cardTop` so the clip visually enters the card's punch hole.
 */
export function lanyard(
  ctx: Ctx,
  cx: number,
  cardTop: number,
  requestedScale = 1,
  clipArt: CanvasImageSource | null = null,
  fullArt: CanvasImageSource | null = null,
) {
  // A photo of the whole lanyard replaces the drawn webbing and hardware alike:
  // it is hung from the top edge with its foot inside the card's punch slot.
  if (fullArt) {
    const iw = (fullArt as HTMLImageElement).width;
    const ih = (fullArt as HTMLImageElement).height;
    if (iw && ih) {
      const h = cardTop + 46;
      const w = (iw / ih) * h;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.4)";
      ctx.shadowBlur = 20;
      ctx.shadowOffsetY = 8;
      ctx.drawImage(fullArt, cx - w / 2, 0, w, h);
      ctx.restore();
      return;
    }
  }

  // The card's top moves as it grows for a tall photo. Shrink the hardware to
  // fit rather than letting the strap collapse to nothing above it.
  const scale = Math.min(requestedScale, cardTop / 300);
  const strapW = 76 * scale;
  // Assembly runs ~202 units from the loop's top bar to the foot of the hook;
  // seat it so that foot lands inside the card's punch slot.
  // Seat it so the hook's foot lands inside the card's punch slot.
  // Seated on the hook's foot, not the assembly's box: the foot lands mid-slot,
  // which puts the hardware clear above the card's top edge and leaves only the
  // hook's lowest curve tucked into the hole.
  const hookTop = cardTop + 38 - clipFootDrop(scale);
  const strapLen = Math.max(1, hookTop + 14 * scale);

  // strap: near-parallel webbing tapering slightly into the swivel
  ctx.save();
  ctx.fillStyle = COLORS.pink;
  ctx.beginPath();
  ctx.moveTo(cx - strapW * 0.6, -4);
  ctx.lineTo(cx - strapW * 0.46, hookTop + 14 * scale);
  ctx.lineTo(cx + strapW * 0.46, hookTop + 14 * scale);
  ctx.lineTo(cx + strapW * 0.6, -4);
  ctx.closePath();
  ctx.fill();

  // fold shading down the centre
  const sh = ctx.createLinearGradient(cx - strapW, 0, cx + strapW, 0);
  sh.addColorStop(0, "rgba(0,0,0,0.16)");
  sh.addColorStop(0.45, "rgba(255,255,255,0.14)");
  sh.addColorStop(1, "rgba(0,0,0,0.2)");
  ctx.fillStyle = sh;
  ctx.fill();
  ctx.restore();

  // Rivet decal, placed proportionally so it stays on the webbing whatever
  // length the strap ends up being.
  const rivetR = Math.min(26 * scale, strapLen * 0.26);
  ctx.save();
  ctx.fillStyle = COLORS.black;
  starburst(ctx, cx, strapLen * 0.33, rivetR, rivetR * 0.38, 10, 0.3, 3);
  ctx.fill();
  ctx.fillStyle = COLORS.cream;
  ctx.beginPath();
  ctx.arc(cx, strapLen * 0.72, Math.min(9 * scale, strapLen * 0.09), 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 2 * scale;
  ctx.stroke();
  ctx.restore();

  if (clipArt) {
    // Real photography of the clip, when supplied: drawn into the same box the
    // vector version occupies so the strap still meets it correctly.
    const iw = (clipArt as HTMLImageElement).width;
    const ih = (clipArt as HTMLImageElement).height;
    const h = clipHeight(scale);
    const w = (iw / ih) * h;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 18 * scale;
    ctx.shadowOffsetY = 6 * scale;
    ctx.drawImage(clipArt, cx - w / 2, hookTop, w, h);
    ctx.restore();
  } else {
    metal(ctx, cx, hookTop, cardTop, scale);
  }
}

/**
 * Chrome trigger snap, drawn to match the reference photograph.
 *
 * Top to bottom: a round-wire loop with a flat top and generously rounded
 * corners whose legs converge on a mushroom collar, then a flat tapered body
 * carrying the spring trigger, then the J-hook that drops into the punch slot.
 *
 * Proportions are taken from the reference at a 130px strap and expressed
 * relative to the strap width, so the whole assembly scales as one piece.
 */
function metal(ctx: Ctx, cx: number, top: number, cardTop: number, s: number) {
  const strapW = 76 * s;
  const k = (strapW / 130) * CLIP_WEIGHT;
  const px = (n: number) => n * k;

  /** Chrome: dark edges, two bright specular bands, a mid tone between. */
  const chrome = (x0: number, x1: number) => {
    const grd = ctx.createLinearGradient(x0, 0, x1, 0);
    grd.addColorStop(0, "#5F6469");
    grd.addColorStop(0.14, "#B9BEC4");
    grd.addColorStop(0.3, "#F2F5F8");
    grd.addColorStop(0.46, "#9AA0A7");
    grd.addColorStop(0.62, "#D8DDE2");
    grd.addColorStop(0.82, "#8E949B");
    grd.addColorStop(1, "#54595E");
    return grd;
  };

  const loopW = px(175);
  const loopH = px(110);
  const wire = px(17);
  const collarY = top + loopH;
  const bodyTop = collarY + px(26);
  const bodyH = px(132);
  const bodyW = px(84);
  const bodyBottom = bodyTop + bodyH;

  /* ---- wire loop ---- */
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.42)";
  ctx.shadowBlur = px(18);
  ctx.shadowOffsetY = px(6);
  ctx.strokeStyle = chrome(cx - loopW / 2, cx + loopW / 2);
  ctx.lineWidth = wire;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx - px(24), collarY);
  ctx.quadraticCurveTo(cx - loopW * 0.5, top + loopH * 0.72, cx - loopW * 0.5, top + loopH * 0.34);
  ctx.quadraticCurveTo(cx - loopW * 0.5, top, cx - loopW * 0.2, top);
  ctx.lineTo(cx + loopW * 0.2, top);
  ctx.quadraticCurveTo(cx + loopW * 0.5, top, cx + loopW * 0.5, top + loopH * 0.34);
  ctx.quadraticCurveTo(cx + loopW * 0.5, top + loopH * 0.72, cx + px(24), collarY);
  ctx.stroke();
  ctx.restore();

  /* ---- mushroom collar the loop swivels on ---- */
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = px(10);
  ctx.shadowOffsetY = px(4);
  ctx.fillStyle = chrome(cx - px(23), cx + px(23));
  // domed cap
  ctx.beginPath();
  ctx.ellipse(cx, collarY - px(4), px(15), px(11), 0, 0, Math.PI * 2);
  ctx.fill();
  // flared base
  ctx.beginPath();
  ctx.moveTo(cx - px(14), collarY - px(2));
  ctx.lineTo(cx + px(14), collarY - px(2));
  ctx.lineTo(cx + px(23), collarY + px(20));
  ctx.lineTo(cx - px(23), collarY + px(20));
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  /* ---- flat tapered body ---- */
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = px(10);
  ctx.shadowOffsetY = px(4);
  ctx.fillStyle = chrome(cx - bodyW / 2, cx + bodyW / 2);
  ctx.beginPath();
  ctx.moveTo(cx - bodyW * 0.42, bodyTop);
  ctx.quadraticCurveTo(cx - bodyW * 0.5, bodyTop + bodyH * 0.3, cx - bodyW * 0.34, bodyTop + bodyH * 0.62);
  ctx.quadraticCurveTo(cx - bodyW * 0.26, bodyBottom, cx, bodyBottom);
  ctx.quadraticCurveTo(cx + bodyW * 0.26, bodyBottom, cx + bodyW * 0.34, bodyTop + bodyH * 0.62);
  ctx.quadraticCurveTo(cx + bodyW * 0.5, bodyTop + bodyH * 0.3, cx + bodyW * 0.42, bodyTop);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  /* ---- spring trigger down the body's left face ---- */
  ctx.save();
  ctx.strokeStyle = "#6C7278";
  ctx.lineWidth = px(7);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - px(16), bodyTop + px(28));
  ctx.lineTo(cx - px(9), bodyTop + px(104));
  ctx.stroke();
  // thumb tab poking out to the left
  ctx.lineWidth = px(9);
  ctx.beginPath();
  ctx.moveTo(cx - px(15), bodyTop + px(52));
  ctx.lineTo(cx - px(34), bodyTop + px(60));
  ctx.stroke();
  ctx.restore();

  /* ---- J-hook: sweeps left, rounds the foot, rises to an open tip ---- */
  // The path is defined once and stroked three times — a dark base for edge
  // definition, the chrome body, then a specular core. Stroking a single fat
  // flat-gradient line is what made this read as a grey blob.
  const hook = () => {
    ctx.beginPath();
    ctx.moveTo(cx - px(2), bodyBottom - px(10));
    ctx.quadraticCurveTo(cx - px(26), bodyBottom + px(30), cx - px(23), bodyBottom + px(66));
    ctx.quadraticCurveTo(cx - px(18), bodyBottom + px(100), cx + px(19), bodyBottom + px(90));
    ctx.quadraticCurveTo(cx + px(47), bodyBottom + px(80), cx + px(44), bodyBottom + px(44));
  };

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // soft contact shadow, kept light: on kraft a heavy one reads as a smudge
  ctx.save();
  ctx.strokeStyle = "rgba(40,30,15,0.16)";
  ctx.lineWidth = px(19);
  ctx.shadowColor = "rgba(40,30,15,0.2)";
  ctx.shadowBlur = px(7);
  ctx.shadowOffsetY = px(3);
  hook();
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = "#4A4F55";
  ctx.lineWidth = px(19);
  hook();
  ctx.stroke();

  ctx.strokeStyle = chrome(cx - px(26), cx + px(47));
  ctx.lineWidth = px(15.5);
  hook();
  ctx.stroke();

  // specular core, offset toward the light
  ctx.strokeStyle = "rgba(255,255,255,0.72)";
  ctx.lineWidth = px(4.5);
  ctx.save();
  ctx.translate(-px(2.5), -px(1.5));
  hook();
  ctx.stroke();
  ctx.restore();
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

/** Kraft card body: grain, rounded corners, drop shadow and punch-hole slot. */
export function cardShell(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
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

  // punch hole
  const slotW = w * 0.19;
  const slotH = h * 0.026;
  const sx = x + (w - slotW) / 2;
  const sy = y + h * 0.032;
  ctx.save();
  ctx.fillStyle = COLORS.greenDeep;
  roundRect(ctx, sx, sy, slotW, slotH, slotH / 2);
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

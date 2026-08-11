import JsBarcode from "jsbarcode";
import { COLORS, EVENT, FONTS } from "../brand";
import {
  Ctx,
  devaBadge,
  font,
  grain,
  roundRect,
  squiggle,
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

  // size the type so a line spans slightly wider than the canvas (edge-cropped)
  let size = 200;
  ctx.font = font(FONTS.display, size, 900);
  size = Math.round((size * (w * 1.06)) / ctx.measureText(lines[0]).width);

  const lineH = size * 0.86;
  lines.forEach((line, i) => {
    ctx.font = font(FONTS.display, size, 900);
    ctx.globalAlpha = i === 0 ? 1 : 0.92;
    ctx.fillText(line, w / 2, top + size * 0.78 + i * lineH);
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
) {
  const [yx, yy, yr] = layout.yellowBurst;
  ctx.save();
  ctx.fillStyle = COLORS.gold;
  starburst(ctx, yx, yy, yr, yr * 0.42, 9, 0.35, 12);
  ctx.fill();
  ctx.restore();

  const [sx, sy, sw] = layout.squiggle;
  squiggle(ctx, sx, sy, sw, sw * 0.075, 3, Math.max(3, w * 0.005), COLORS.pink);

  const [dx, dy, ds] = layout.deva;
  devaBadge(ctx, dx, dy, ds, { rotate: -0.07, glow: true });

  const [px, py, pr] = layout.pinkBurst;
  ctx.save();
  ctx.fillStyle = COLORS.pink;
  starburst(ctx, px, py, pr, pr * 0.36, 8, 0.2, 5);
  ctx.fill();
  ctx.restore();

  sparkle(ctx, w * 0.9, h * 0.76, w * 0.028, COLORS.cream, 0.75);
  sparkle(ctx, w * 0.955, h * 0.735, w * 0.015, COLORS.cream, 0.5);
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
 * Pink strap from the top edge + black starburst rivet + silver swivel hook,
 * ending just above `cardTop` so the clip visually enters the card's punch hole.
 */
export function lanyard(ctx: Ctx, cx: number, cardTop: number, requestedScale = 1) {
  // The card's top moves as it grows for a tall photo. Shrink the hardware to
  // fit rather than letting the strap collapse to nothing above it.
  const scale = Math.min(requestedScale, cardTop / 300);
  const strapW = 92 * scale;
  const hookTop = cardTop - 214 * scale;
  const strapLen = Math.max(1, hookTop + 22 * scale);

  // strap: near-parallel webbing tapering slightly into the swivel
  ctx.save();
  ctx.fillStyle = COLORS.pink;
  ctx.beginPath();
  ctx.moveTo(cx - strapW * 0.6, -4);
  ctx.lineTo(cx - strapW * 0.4, hookTop + 22 * scale);
  ctx.lineTo(cx + strapW * 0.4, hookTop + 22 * scale);
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

  metal(ctx, cx, hookTop, cardTop, scale);
}

/** Silver swivel hook: barrel, ring and the sprung hook arm. */
function metal(ctx: Ctx, cx: number, top: number, cardTop: number, scale: number) {
  const g = (x0: number, x1: number) => {
    const grd = ctx.createLinearGradient(x0, 0, x1, 0);
    grd.addColorStop(0, COLORS.silverLo);
    grd.addColorStop(0.28, COLORS.silverHi);
    grd.addColorStop(0.55, COLORS.silver);
    grd.addColorStop(1, COLORS.silverLo);
    return grd;
  };

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 18 * scale;
  ctx.shadowOffsetY = 6 * scale;

  // swivel barrel
  const bw = 76 * scale;
  const bh = 54 * scale;
  ctx.fillStyle = g(cx - bw / 2, cx + bw / 2);
  roundRect(ctx, cx - bw / 2, top, bw, bh, 12 * scale);
  ctx.fill();

  // trapezoid shoulder
  ctx.beginPath();
  ctx.moveTo(cx - bw * 0.42, top + bh);
  ctx.lineTo(cx + bw * 0.42, top + bh);
  ctx.lineTo(cx + bw * 0.26, top + bh + 26 * scale);
  ctx.lineTo(cx - bw * 0.26, top + bh + 26 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // hook body — an open C reaching down to the card
  const hookTop = top + bh + 20 * scale;
  const hookH = cardTop - hookTop + 34 * scale;
  const hookW = 92 * scale;
  ctx.save();
  ctx.strokeStyle = g(cx - hookW / 2, cx + hookW / 2);
  ctx.lineWidth = 22 * scale;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = 14 * scale;
  ctx.beginPath();
  ctx.moveTo(cx - hookW * 0.22, hookTop);
  ctx.lineTo(cx - hookW * 0.4, hookTop + hookH * 0.52);
  ctx.quadraticCurveTo(
    cx - hookW * 0.5,
    hookTop + hookH,
    cx + hookW * 0.06,
    hookTop + hookH * 0.94,
  );
  ctx.quadraticCurveTo(
    cx + hookW * 0.5,
    hookTop + hookH * 0.86,
    cx + hookW * 0.34,
    hookTop + hookH * 0.34,
  );
  ctx.stroke();
  ctx.restore();

  // sprung gate
  ctx.save();
  ctx.strokeStyle = COLORS.silverLo;
  ctx.lineWidth = 7 * scale;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - hookW * 0.2, hookTop + hookH * 0.22);
  ctx.lineTo(cx + hookW * 0.26, hookTop + hookH * 0.66);
  ctx.stroke();
  ctx.restore();
}

/* ------------------------------------------------------------- icon strip */

export type IconKind = "code" | "ai" | "brain" | "text" | "nodes";
export const ICON_ORDER: IconKind[] = ["code", "ai", "brain", "text", "nodes"];

/**
 * Vertical column of outlined discipline chips down the card's left gutter.
 * `active` (set from the user's stack) renders a chip filled rather than hollow.
 */
export function iconColumn(
  ctx: Ctx,
  x: number,
  y: number,
  size: number,
  gap: number,
  active: Set<IconKind> = new Set(),
) {
  ICON_ORDER.forEach((kind, i) => {
    const cy = y + i * (size + gap);
    const on = active.has(kind);
    ctx.save();
    roundRect(ctx, x, cy, size, size, size * 0.16);
    if (on) {
      ctx.fillStyle = COLORS.ink;
      ctx.fill();
    }
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = Math.max(1.5, size * 0.055);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(x + size / 2, cy + size / 2);
    const fg = on ? COLORS.kraft : COLORS.ink;
    ctx.strokeStyle = fg;
    ctx.fillStyle = fg;
    ctx.lineWidth = Math.max(1.4, size * 0.06);
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
    case "ai": {
      ctx.font = font(FONTS.display, s * 1.25, 900);
      ctx.fillText("AI", 0, s * 0.06);
      break;
    }
    case "brain": {
      // Kept deliberately coarse: at ~40px chip size, fine sulci turn to mud.
      // A lobed outline plus one central fissure is what actually reads.
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.62, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.62);
      ctx.lineTo(0, s * 0.62);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * 0.44, -s * 0.24);
      ctx.quadraticCurveTo(-s * 0.06, -s * 0.14, -s * 0.34, s * 0.16);
      ctx.moveTo(s * 0.44, s * 0.24);
      ctx.quadraticCurveTo(s * 0.06, s * 0.14, s * 0.34, -s * 0.16);
      ctx.stroke();
      break;
    }
    case "text": {
      ctx.font = font(FONTS.display, s * 1.3, 900);
      ctx.fillText("T", 0, s * 0.08);
      // selection handles around the glyph
      ctx.lineWidth = Math.max(1, s * 0.08);
      for (const [hx, hy] of [
        [-s * 0.6, -s * 0.6],
        [s * 0.6, -s * 0.6],
        [-s * 0.6, s * 0.6],
        [s * 0.6, s * 0.6],
      ]) {
        ctx.strokeRect(hx - s * 0.08, hy - s * 0.08, s * 0.16, s * 0.16);
      }
      break;
    }
    case "nodes": {
      // hub-and-spoke network
      const hub: [number, number] = [0, 0];
      const leaves: [number, number][] = [
        [0, -s * 0.66],
        [-s * 0.62, s * 0.34],
        [s * 0.62, s * 0.34],
      ];
      ctx.lineWidth = Math.max(1.1, ctx.lineWidth * 0.8);
      ctx.beginPath();
      for (const [lx, ly] of leaves) {
        ctx.moveTo(hub[0], hub[1]);
        ctx.lineTo(lx, ly);
      }
      ctx.stroke();
      for (const [px, py] of [hub, ...leaves]) {
        ctx.beginPath();
        ctx.arc(px, py, s * 0.19, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
  }
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

/** Small-caps footer line used on both card faces. */
export function cardFooter(ctx: Ctx, cx: number, y: number, size: number) {
  ctx.save();
  ctx.fillStyle = COLORS.inkSoft;
  ctx.font = font(FONTS.body, size, 600);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  trackedText(ctx, EVENT.studio, cx, y, size * 0.14, "center");
  ctx.restore();
}

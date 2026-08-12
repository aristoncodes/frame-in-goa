import { CANVAS, COLORS, EVENT, FONTS } from "../brand";
import { NO_ASSETS, type BrandAssets } from "./assets";
import {
  barcode,
  bottomWordmark,
  cardFooter,
  cardShell,
  decorations,
  iconColumn,
  iconRow,
  lanyard,
  mirroredHeadline,
  posterBackground,
  RenderEnv,
} from "./motifs";
import {
  Ctx,
  devaBadge,
  drawPhoto,
  ellipsize,
  fitFontSize,
  font,
  roundRect,
  trackedText,
  type PhotoTransform,
} from "./primitives";

export type CardLayout = ReturnType<typeof cardLayout>;

export type { PhotoTransform, PhotoFit } from "./primitives";
export { DEFAULT_TRANSFORM, DEFAULT_PFP_TRANSFORM } from "./primitives";

export type CardData = {
  name: string;
  stack: string;
  role: string;
  builderTitle: string;
  photo: CanvasImageSource | null;
  transform: PhotoTransform;
};

export type CardFace = "front" | "back";

const W = CANVAS.card.w;
const H = CANVAS.card.h;

const CARD_W = 476;
const CARD_R = 30;
const PAD = 34;
const CHIP = 40;
const CHIP_GAP = 15;

/** Height of the five stacked discipline chips — the row's natural minimum. */
const CHIP_COL_H = CHIP * 5 + CHIP_GAP * 4;

/** "BUILDER ID" is fixed text, so its size is a constant, not a fit-at-runtime. */
const TITLE_SIZE = 66;
/** Card top → top of the photo/icon row. */
const HEADER_H = 98 + Math.round(TITLE_SIZE * 0.96) + 22;
/** Bottom of the identity block → card bottom (barcode row + footer). */
const FOOTER_H = 150;

const CARD_X = (W - CARD_W) / 2;
const CONTENT_LEFT = CARD_X + PAD;
const CONTENT_RIGHT = CARD_X + CARD_W - PAD;
const RULE_X = CONTENT_LEFT + CHIP + 22;
/**
 * Everything except the header and the barcode row is indented to this column,
 * matching the reference badge: the chips run down the left gutter while the
 * photo *and* the identity lines share one left edge to the right of them.
 */
const PHOTO_X = RULE_X + 22;

/**
 * The photo slot is a **fixed window** — the card is one size, always, so it
 * cannot resize itself around the picture. `contain` fits the whole photo inside
 * this slot at its own aspect ratio (nothing cropped, the remainder filled with
 * a blurred copy of the photo rather than empty bars); `cover` fills the slot and
 * crops. Its height matches the chip column so the row reads as one band.
 */
const SLOT_W = CONTENT_RIGHT - PHOTO_X;
const SLOT_H = CHIP_COL_H;

/** Kraft mount between the slot's rule and the photo itself. */
const MAT = 12;

/** Aspect the crop UI presents, so its viewport is exactly the card's window. */
export const PHOTO_SLOT_ASPECT = (SLOT_W - MAT * 2) / (SLOT_H - MAT * 2);

/**
 * Fixed card height, budgeted for the worst case: a two-line name. The identity
 * block is anchored to its bottom, so a one-line name simply sits lower with
 * more air above it rather than shrinking the card.
 */
const IDENTITY_RESERVE = 216;
const CARD_H = HEADER_H + SLOT_H + IDENTITY_RESERVE + FOOTER_H;
const CARD_Y = 1186 - CARD_H;

const NAME_MAX = 44;
/** Below this, a two-line name beats shrinking further. */
const NAME_WRAP_BELOW = 30;
const NAME_MIN = 19;

export type NameLayout = { lines: string[]; size: number; lineHeight: number };

/** Width the identity lines get: the full card interior. */
export const NAME_WIDTH = CONTENT_RIGHT - CONTENT_LEFT;

/**
 * How a name is set. Short names get one big line. A long one ("Bompelliwar
 * Saikiran") wraps onto two balanced lines at the largest size that fits both,
 * rather than shrinking to something unreadable. A single unbroken word that
 * still won't fit is shrunk to the floor and then ellipsised — the card is never
 * allowed to overflow.
 */
export function layoutName(ctx: Ctx, raw: string, maxWidth = NAME_WIDTH): NameLayout {
  const name = (raw.trim() || "YOUR NAME").toUpperCase();
  const one = fitFontSize(ctx, name, FONTS.display, 900, NAME_MAX, NAME_MIN, maxWidth, 0.5);
  const single = { lines: [name], size: one, lineHeight: one * 0.92 };
  if (one >= NAME_WRAP_BELOW) return single;

  const words = name.split(/\s+/);
  if (words.length < 2) return single;

  // Try every split point, keep the one that lets both lines run largest.
  let best: NameLayout | null = null;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    const size = Math.min(
      fitFontSize(ctx, a, FONTS.display, 900, NAME_MAX, NAME_MIN, maxWidth, 0.5),
      fitFontSize(ctx, b, FONTS.display, 900, NAME_MAX, NAME_MIN, maxWidth, 0.5),
    );
    if (!best || size > best.size) best = { lines: [a, b], size, lineHeight: size * 0.92 };
  }
  return best && best.size > one ? best : single;
}

/**
 * The punch hole. Round rather than a slot, because what seats in it is a
 * grommet. Set high and small: the eyelet's flange reaches ~31px out from here,
 * and it has to land on kraft without crowding the header line beneath it.
 */
const PUNCH_R = 14;
const PUNCH_DROP = 53;

/** One fixed geometry, shared by both faces and by every photo. */
export function cardLayout() {
  return {
    x: CARD_X,
    y: CARD_Y,
    w: CARD_W,
    h: CARD_H,
    r: CARD_R,
    photo: { x: PHOTO_X, y: CARD_Y + HEADER_H, w: SLOT_W, h: SLOT_H },
    // The single source for the hole: cardShell cuts it and the lanyard seats
    // its ring in it, so the two can never drift apart.
    punch: { cx: CARD_X + CARD_W / 2, cy: CARD_Y + PUNCH_DROP, r: PUNCH_R },
  };
}

/* ------------------------------------------------------------------ poster */

/**
 * Draws everything behind the card: green field, mirrored headline, starbursts,
 * squiggle, गोवा badge and the GOA 2026 wordmark. The lanyard is not part of
 * this — it goes on top of the card, not behind it.
 */
function poster(ctx: Ctx, assets: BrandAssets) {
  posterBackground(ctx, W, H);
  mirroredHeadline(ctx, W, { top: 4 });
  bottomWordmark(ctx, W, H);
  decorations(ctx, W, H, {
    yellowBurst: [W * 0.185, H * 0.4, W * 0.185],
    pinkBurst: [W * 0.755, H * 0.685, W * 0.055],
    squiggle: [W * 0.02, H * 0.6, W * 0.245],
    deva: [W * 0.857, H * 0.415, 150],
  }, assets.goa);
}

/* ------------------------------------------------------------- front face */

function drawFront(ctx: Ctx, env: RenderEnv, data: CardData, L: CardLayout, assets: BrandAssets) {
  const { x, y, w, h, r } = L;
  cardShell(ctx, x, y, w, h, r, L.punch);

  const left = CONTENT_LEFT;
  const right = CONTENT_RIGHT;
  const innerW = right - left;
  // Identity lines span the full card interior rather than being indented to
  // the photo, so long names have the most room available.
  const col = left;
  const colW = innerW;

  /* header ------------------------------------------------------------- */
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.ink;
  ctx.font = font(FONTS.display, 25, 900);
  trackedText(ctx, EVENT.name, left, y + 98, 0.5);

  ctx.font = font(FONTS.display, TITLE_SIZE, 900);
  trackedText(ctx, "BUILDER ID", left, y + 98 + Math.round(TITLE_SIZE * 0.96), 1);
  ctx.restore();

  const rowTop = y + HEADER_H;

  /* icon column + photo ------------------------------------------------ */
  iconColumn(ctx, left, rowTop, CHIP, CHIP_GAP);

  // hairline rule beside the chips, spanning the row
  ctx.save();
  ctx.strokeStyle = "rgba(58,42,26,0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(RULE_X, rowTop + 2);
  ctx.lineTo(RULE_X, rowTop + L.photo.h - 2);
  ctx.stroke();
  ctx.restore();

  drawPortrait(ctx, data, L.photo.x, L.photo.y, L.photo.w, L.photo.h);

  /* identity block ----------------------------------------------------- */
  // Anchored to its bottom against the fixed meta row, so a name that wraps to
  // two lines grows upward into the air under the photo instead of resizing the
  // card. The block always ends at the same y.
  const metaTop = y + h - 118;
  const nameLayout = layoutName(ctx, data.name, colW);
  const wrapExtra = (nameLayout.lines.length - 1) * nameLayout.lineHeight;
  let cy = metaTop - 30 - 126 - wrapExtra;

  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = COLORS.ink;

  nameLayout.lines.forEach((line, i) => {
    ctx.font = font(FONTS.display, nameLayout.size, 900);
    trackedText(ctx, ellipsize(ctx, line, colW), col, cy + i * nameLayout.lineHeight, 0.5);
  });
  cy += wrapExtra + 34;

  // STACK: <input>
  const labelSize = 18;
  ctx.font = font(FONTS.body, labelSize, 700);
  const stackLabelW = trackedText(ctx, "STACK:", col, cy, 0.8) + 8;
  ctx.font = font(FONTS.body, 21, 500);
  ctx.fillText(
    ellipsize(ctx, data.stack.trim() || "Add your stack", colW - stackLabelW),
    col + stackLabelW,
    cy,
  );
  cy += 30;

  // role / title line
  ctx.font = font(FONTS.body, 23, 600);
  ctx.fillText(ellipsize(ctx, data.role.trim() || "Builder", colW), col, cy);
  cy += 34;

  // BUILDER TITLE:
  ctx.font = font(FONTS.body, labelSize, 700);
  trackedText(ctx, "BUILDER TITLE:", col, cy, 0.8);
  cy += 28;
  ctx.font = font(FONTS.body, 23, 500);
  ctx.fillText(ellipsize(ctx, data.builderTitle, colW), col, cy);
  ctx.restore();

  /* bottom row: barcode + meta ----------------------------------------- */
  const bcW = innerW * 0.46;
  barcode(ctx, env, barcodeValue(data), left, metaTop, bcW, 48);

  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = COLORS.ink;
  ctx.font = font(FONTS.body, 12.5, 600);
  const metaX = left + bcW + 18;
  ctx.strokeStyle = "rgba(58,42,26,0.4)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(metaX - 12, metaTop);
  ctx.lineTo(metaX - 11, metaTop + 48);
  ctx.stroke();
  [`DATES: ${EVENT.dates}`, `LOCATION: ${EVENT.location}`, `URL: ${EVENT.url}`].forEach(
    (line, i) => {
      ctx.fillText(line, metaX, metaTop + 12 + i * 17);
    },
  );
  ctx.restore();

  cardFooter(ctx, x + w / 2, y + h - 26, 15, assets.studio, env);
}

/**
 * The portrait window: a clean kraft mount, then the photo inset within it.
 * The mount carries the paper colour so the picture itself needs no tinting —
 * it reads as mounted on the card rather than pasted onto it.
 */
function drawPortrait(
  ctx: Ctx,
  data: CardData,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
) {
  const outerR = 20;
  const px = sx + MAT;
  const py = sy + MAT;
  const pw = sw - MAT * 2;
  const ph = sh - MAT * 2;
  const r = outerR - MAT * 0.5;

  // kraft mount, clean of the card's grain so the margin reads crisply
  ctx.save();
  ctx.fillStyle = COLORS.kraft;
  roundRect(ctx, sx, sy, sw, sh, outerR);
  ctx.fill();
  ctx.strokeStyle = "rgba(58,42,26,0.42)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // photo, untinted
  ctx.save();
  roundRect(ctx, px, py, pw, ph, r);
  ctx.clip();
  if (data.photo) {
    // Kraft backdrop, so an uncropped photo is matted in the card's own paper
    // rather than sitting on a contrasting fill.
    drawPhoto(ctx, data.photo, px, py, pw, ph, data.transform, COLORS.kraft);
  } else {
    ctx.fillStyle = COLORS.kraftDeep;
    ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = "rgba(58,42,26,0.28)";
    ctx.beginPath();
    ctx.arc(px + pw / 2, py + ph * 0.36, ph * 0.19, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(px + pw / 2, py + ph * 1.02, ph * 0.36, ph * 0.42, 0, Math.PI, 0);
    ctx.fill();
  }
  ctx.restore();

  // hairline where the photo meets the mount
  ctx.save();
  roundRect(ctx, px, py, pw, ph, r);
  ctx.strokeStyle = "rgba(58,42,26,0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function barcodeValue(data: CardData) {
  const base = `${data.name || "BUILDER"}${data.stack}${data.role}`
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  let h = 5381;
  for (let i = 0; i < base.length; i++) h = ((h * 33) ^ base.charCodeAt(i)) >>> 0;
  return `HHG26-${base.slice(0, 6).padEnd(6, "X")}-${h.toString(36).toUpperCase().slice(0, 6)}`;
}

/* -------------------------------------------------------------- back face */

/**
 * The reverse, built around the ogee-arch cartouche from the HH Goa banner
 * artwork: a double rule, an arch holding the wordmark, the discipline chips
 * repeated as a horizontal strip, and the residency's terms at the foot.
 *
 * If `logo` is supplied (NEXT_PUBLIC_LOGO_URL) it is drawn inside the arch
 * as-is; otherwise the wordmark is built from the same type system as the rest.
 */
function drawBack(ctx: Ctx, env: RenderEnv, L: CardLayout, assets: BrandAssets) {
  const { x, y, w, h, r } = L;
  cardShell(ctx, x, y, w, h, r, L.punch);

  const cx = x + w / 2;
  const inset = 24;
  const frameTop = y + 70;
  const frameBottom = y + h - 54;

  /* double rule with clipped corners ---------------------------------- */
  ctx.save();
  ctx.strokeStyle = "rgba(58,42,26,0.55)";
  ctx.lineWidth = 2.5;
  roundRect(ctx, x + inset, frameTop, w - inset * 2, frameBottom - frameTop, 16);
  ctx.stroke();
  ctx.strokeStyle = "rgba(58,42,26,0.3)";
  ctx.lineWidth = 1.4;
  roundRect(ctx, x + inset + 7, frameTop + 7, w - inset * 2 - 14, frameBottom - frameTop - 14, 11);
  ctx.stroke();
  ctx.restore();

  /* header strip ------------------------------------------------------ */
  ctx.save();
  ctx.fillStyle = COLORS.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = font(FONTS.body, 12, 800);
  trackedText(ctx, "ADMIT ONE · 247 BUILDERS", cx, frameTop + 40, 2.4, "center");
  ctx.restore();
  rule(ctx, cx, frameTop + 56, w * 0.42);

  /* arch cartouche ---------------------------------------------------- */
  // Centred in the space between the header rule and the chip strip, so the card
  // grows without leaving a pool of dead kraft under the arch.
  const blockTop = frameTop + 74;
  const blockBottom = frameBottom - 132;
  const archW = w - 116;
  const archH = Math.min(h * 0.42, blockBottom - blockTop - 24);
  const archCy = blockTop + (blockBottom - blockTop) / 2;

  ctx.save();
  ogeeArch(ctx, cx, archCy, archW, archH);
  ctx.fillStyle = "rgba(58,42,26,0.06)";
  ctx.fill();
  ctx.strokeStyle = "rgba(58,42,26,0.6)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  // inner hairline echoing the arch
  ctx.save();
  ogeeArch(ctx, cx, archCy, archW - 18, archH - 18);
  ctx.strokeStyle = "rgba(58,42,26,0.28)";
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();

  if (assets.logo) {
    const iw = (assets.logo as HTMLImageElement).width;
    const ih = (assets.logo as HTMLImageElement).height;
    const s = Math.min((archW - 70) / iw, (archH - 90) / ih);
    ctx.drawImage(assets.logo, cx - (iw * s) / 2, archCy - (ih * s) / 2, iw * s, ih * s);
  } else {
    drawLockup(ctx, env, cx, archCy + archH * 0.1, archW - 72, assets);
  }

  /* chip strip -------------------------------------------------------- */
  const chip = 34;
  const chipGap = 13;
  const stripW = chip * 5 + chipGap * 4;
  iconRow(ctx, cx - stripW / 2, frameBottom - 116, chip, chipGap);

  /* terms ------------------------------------------------------------- */
  ctx.save();
  ctx.fillStyle = COLORS.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = font(FONTS.body, 16, 700);
  ctx.font = font(FONTS.body, 14, 700);
  trackedText(ctx, `${EVENT.dates} · ${EVENT.location}`, cx, frameBottom - 56, 1, "center");
  ctx.fillStyle = COLORS.inkSoft;
  // Mono is wider than the grotesk this was set for, so keep it short and small.
  ctx.font = font(FONTS.body, 11, 500);
  ctx.fillText("Non-transferable · carry it, don't laminate it", cx, frameBottom - 32);
  ctx.fillText(EVENT.url.toLowerCase(), cx, frameBottom - 15);
  ctx.restore();

  cardFooter(ctx, cx, y + h - 24, 14, assets.studio, env);
}

/** Short centred hairline with a diamond at each end. */
function rule(ctx: Ctx, cx: number, y: number, width: number) {
  ctx.save();
  ctx.strokeStyle = "rgba(58,42,26,0.45)";
  ctx.fillStyle = "rgba(58,42,26,0.6)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(cx - width / 2, y);
  ctx.lineTo(cx + width / 2, y);
  ctx.stroke();
  for (const dx of [-width / 2, width / 2]) {
    ctx.beginPath();
    ctx.moveTo(cx + dx, y - 4);
    ctx.lineTo(cx + dx + 4, y);
    ctx.lineTo(cx + dx, y + 4);
    ctx.lineTo(cx + dx - 4, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/**
 * The cusped ogee arch that frames the wordmark on the HH Goa banner: straight
 * sides, shoulders that swell outward, then an S-curve to a point.
 */
function ogeeArch(ctx: Ctx, cx: number, cy: number, w: number, h: number) {
  const hw = w / 2;
  const hh = h / 2;
  ctx.beginPath();
  ctx.moveTo(cx - hw, cy + hh);
  ctx.lineTo(cx - hw, cy - hh * 0.1);
  ctx.bezierCurveTo(
    cx - hw, cy - hh * 0.56,
    cx - hw * 0.92, cy - hh * 0.68,
    cx - hw * 0.5, cy - hh * 0.68,
  );
  ctx.bezierCurveTo(
    cx - hw * 0.2, cy - hh * 0.68,
    cx - hw * 0.12, cy - hh * 0.84,
    cx, cy - hh,
  );
  ctx.bezierCurveTo(
    cx + hw * 0.12, cy - hh * 0.84,
    cx + hw * 0.2, cy - hh * 0.68,
    cx + hw * 0.5, cy - hh * 0.68,
  );
  ctx.bezierCurveTo(
    cx + hw * 0.92, cy - hh * 0.68,
    cx + hw, cy - hh * 0.56,
    cx + hw, cy - hh * 0.1,
  );
  ctx.lineTo(cx + hw, cy + hh);
  ctx.closePath();
}

/** HACKER / HOUSE stacked with the गोवा sticker locked over the centre. */
function drawLockup(
  ctx: Ctx,
  env: RenderEnv,
  cx: number,
  cy: number,
  maxW: number,
  assets: BrandAssets,
) {
  let size: number;

  if (assets.wordmark) {
    // Official "Hacker House" artwork, tinted to the card's ink so it sits on
    // kraft rather than punching a coloured hole in it.
    const iw = (assets.wordmark as HTMLImageElement).width;
    const ih = (assets.wordmark as HTMLImageElement).height;
    const w = maxW;
    const h = (ih / iw) * w;
    size = h * 1.6;

    // Recoloured through an offscreen buffer from the render env, so this works
    // the same in the browser and in the offline harness.
    const tw = Math.max(1, Math.round(w));
    const th = Math.max(1, Math.round(h));
    const { canvas: buf, ctx: bctx } = env.createCanvas(tw, th);
    bctx.drawImage(assets.wordmark, 0, 0, tw, th);
    bctx.globalCompositeOperation = "source-in";
    bctx.fillStyle = COLORS.ink;
    bctx.fillRect(0, 0, tw, th);
    ctx.drawImage(buf, cx - w / 2, cy - h / 2, w, h);
  } else {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = COLORS.ink;
    size = 120;
    ctx.font = font(FONTS.display, size, 900);
    size = Math.round((size * maxW) / ctx.measureText("HACKER").width);
    ctx.font = font(FONTS.display, size, 900);
    ctx.fillText("HACKER", cx, cy - size * 0.44);
    ctx.fillText("HOUSE", cx, cy + size * 0.44);
    ctx.restore();
  }

  // Sized against the official sticker's own outline, which is heavier than the
  // type this used to be set in — at the old 0.52 it swallowed "ER…H".
  devaBadge(ctx, cx, cy - size * 0.03, size * 0.4, {
    rotate: -0.06,
    glow: false,
    image: assets.goa,
  });

  ctx.save();
  ctx.fillStyle = COLORS.inkSoft;
  ctx.font = font(FONTS.body, 18, 700);
  ctx.textAlign = "center";
  trackedText(ctx, "GOA 2026", cx, cy + size * 1.15, 4, "center");
  ctx.restore();
}

/* ------------------------------------------------------------------ entry */

export function renderIdCard(
  ctx: Ctx,
  env: RenderEnv,
  data: CardData,
  face: CardFace,
  assets: BrandAssets = NO_ASSETS,
) {
  // Both faces are laid out from the same geometry, so flipping never changes
  // the card's silhouette even when a tall photo has grown it.
  const L = cardLayout();
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  poster(ctx, assets);

  if (face === "front") drawFront(ctx, env, data, L, assets);
  else drawBack(ctx, env, L, assets);

  // The lanyard is one piece drawn over whichever face is showing, so flipping
  // the card swaps only what is underneath it. Nothing is layered behind the
  // card: the grommet seats in the hole, and the hole is the only contact.
  lanyard(ctx, L.punch);

  ctx.restore();
}

export const ID_CARD_SIZE = { w: W, h: H };

import { CANVAS, COLORS, EVENT, FONTS } from "../brand";
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
  clamp,
  Ctx,
  devaBadge,
  drawPhoto,
  ellipsize,
  fitFontSize,
  font,
  roundRect,
  trackedText,
  type PhotoFit,
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
/** Identity block: gap under the photo, then the four text lines. */
const IDENTITY_H = 46 + 130;
/** Bottom of the content block → card bottom (barcode row + footer). */
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

const PHOTO_MAX_W = CONTENT_RIGHT - PHOTO_X;
// Capped so a 9:16 phone selfie still leaves the lanyard room above the card and
// the GOA 2026 wordmark room below it.
const PHOTO_MAX_H = 340;
/** Window used in `cover` mode — the reference badge's landscape crop. */
const PHOTO_COVER_H = CHIP_COL_H;

/**
 * The photo window sizes itself to the uploaded photo.
 *
 * In `contain` mode it takes the photo's own aspect ratio (bounded by the space
 * available on the card), so the picture fits *exactly*: nothing is cropped and
 * there are no letterbox bars either. In `cover` mode the window is the fixed
 * landscape crop from the reference badge and the photo fills it.
 */
export function photoWindow(photoAspect: number | null, fit: PhotoFit) {
  if (!photoAspect || !isFinite(photoAspect) || photoAspect <= 0 || fit === "cover") {
    return { w: PHOTO_MAX_W, h: PHOTO_COVER_H };
  }
  let w = PHOTO_MAX_W;
  let h = w / photoAspect;
  if (h > PHOTO_MAX_H) {
    h = PHOTO_MAX_H;
    w = h * photoAspect;
  }
  return { w, h };
}

/**
 * Full card geometry for a given photo. Both faces are laid out from this, so a
 * card that grew for a tall portrait keeps the same silhouette front and back.
 */
export function cardLayout(photoAspect: number | null, fit: PhotoFit) {
  const photo = photoWindow(photoAspect, fit);
  // The chip column sits beside the photo and runs on past it, so the content
  // block is whichever is taller: the chips, or the photo plus its text.
  const contentH = Math.max(CHIP_COL_H, photo.h + IDENTITY_H);
  const h = HEADER_H + contentH + FOOTER_H;
  // Anchor the card's bottom near the GOA 2026 wordmark, then clamp the top so
  // a tall card never rides up into the mirrored headline.
  const y = clamp(1186 - h, 336, 404);
  return { x: CARD_X, y, w: CARD_W, h, r: CARD_R, contentH, photo };
}

/** Aspect the crop UI should present so its viewport matches the card exactly. */
export function previewAspect(photoAspect: number | null, fit: PhotoFit) {
  const win = photoWindow(photoAspect, fit);
  return win.w / win.h;
}

/* ------------------------------------------------------------------ poster */

/**
 * Draws everything behind the card: green field, mirrored headline, starbursts,
 * squiggle, गोवा badge, GOA 2026 wordmark, lanyard strap and clip.
 */
function poster(ctx: Ctx) {
  posterBackground(ctx, W, H);
  mirroredHeadline(ctx, W, { top: 4 });
  bottomWordmark(ctx, W, H);
  decorations(ctx, W, H, {
    yellowBurst: [W * 0.185, H * 0.4, W * 0.185],
    pinkBurst: [W * 0.755, H * 0.685, W * 0.055],
    squiggle: [W * 0.02, H * 0.6, W * 0.245],
    deva: [W * 0.857, H * 0.415, 150],
  });
}

/* ------------------------------------------------------------- front face */

function drawFront(ctx: Ctx, env: RenderEnv, data: CardData, L: CardLayout) {
  const { x, y, w, h, r } = L;
  cardShell(ctx, x, y, w, h, r);

  const left = CONTENT_LEFT;
  const right = CONTENT_RIGHT;
  const innerW = right - left;
  // The identity lines share the photo's left edge, clear of the chip column.
  const col = PHOTO_X;
  const colW = right - col;

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

  // hairline rule beside the chips, running the depth of the photo
  ctx.save();
  ctx.strokeStyle = "rgba(58,42,26,0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(RULE_X, rowTop + 2);
  ctx.lineTo(RULE_X, rowTop + Math.max(CHIP_COL_H, L.photo.h) - 2);
  ctx.stroke();
  ctx.restore();

  drawPortrait(ctx, data, col, rowTop, L.photo.w, L.photo.h);

  /* identity block ----------------------------------------------------- */
  const metaTop = y + h - 118;
  let cy = rowTop + L.photo.h + 52;
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = COLORS.ink;

  const displayName = (data.name.trim() || "YOUR NAME").toUpperCase();
  fitFontSize(ctx, displayName, FONTS.display, 900, 44, 20, colW, 0.5);
  trackedText(ctx, displayName, col, cy, 0.5);
  cy += 34;

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
  ctx.font = font(FONTS.body, 14, 600);
  const metaX = left + bcW + 20;
  ctx.strokeStyle = "rgba(58,42,26,0.4)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(metaX - 12, metaTop);
  ctx.lineTo(metaX - 11, metaTop + 48);
  ctx.stroke();
  [`DATES: ${EVENT.dates}`, `LOCATION: ${EVENT.location}`, `URL: ${EVENT.url}`].forEach(
    (line, i) => {
      ctx.fillText(line, metaX, metaTop + 13 + i * 18);
    },
  );
  ctx.restore();

  cardFooter(ctx, x + w / 2, y + h - 30, 15);
}

/** Rounded-square portrait window with a kraft border and inner shadow. */
function drawPortrait(
  ctx: Ctx,
  data: CardData,
  px: number,
  py: number,
  pw: number,
  ph: number,
) {
  const r = 18;
  ctx.save();
  roundRect(ctx, px, py, pw, ph, r);
  ctx.clip();
  if (data.photo) {
    drawPhoto(ctx, data.photo, px, py, pw, ph, data.transform);
  } else {
    ctx.fillStyle = COLORS.kraftDeep;
    ctx.fillRect(px, py, pw, ph);
    // placeholder bust
    ctx.fillStyle = "rgba(58,42,26,0.28)";
    ctx.beginPath();
    ctx.arc(px + pw / 2, py + ph * 0.36, ph * 0.19, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(px + pw / 2, py + ph * 1.02, ph * 0.36, ph * 0.42, 0, Math.PI, 0);
    ctx.fill();
  }
  const inner = ctx.createLinearGradient(px, py, px, py + ph);
  inner.addColorStop(0, "rgba(0,0,0,0.16)");
  inner.addColorStop(0.35, "rgba(0,0,0,0)");
  ctx.fillStyle = inner;
  ctx.fillRect(px, py, pw, ph);
  ctx.restore();

  ctx.save();
  roundRect(ctx, px, py, pw, ph, r);
  ctx.strokeStyle = COLORS.kraftDeep;
  ctx.lineWidth = 5;
  ctx.stroke();
  roundRect(ctx, px - 3.5, py - 3.5, pw + 7, ph + 7, r + 3);
  ctx.strokeStyle = "rgba(58,42,26,0.35)";
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
function drawBack(ctx: Ctx, logo: CanvasImageSource | null, L: CardLayout) {
  const { x, y, w, h, r } = L;
  cardShell(ctx, x, y, w, h, r);

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
  ctx.font = font(FONTS.body, 14, 800);
  trackedText(ctx, "ADMIT ONE  ·  247 BUILDERS", cx, frameTop + 40, 3, "center");
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

  if (logo) {
    const iw = (logo as HTMLImageElement).width;
    const ih = (logo as HTMLImageElement).height;
    const s = Math.min((archW - 70) / iw, (archH - 90) / ih);
    ctx.drawImage(logo, cx - (iw * s) / 2, archCy - (ih * s) / 2, iw * s, ih * s);
  } else {
    drawLockup(ctx, cx, archCy + archH * 0.1, archW - 72);
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
  trackedText(ctx, `${EVENT.dates}  ·  ${EVENT.location}`, cx, frameBottom - 56, 1.4, "center");
  ctx.fillStyle = COLORS.inkSoft;
  ctx.font = font(FONTS.body, 13, 500);
  ctx.fillText("Non-transferable. Carry it, don't laminate it.", cx, frameBottom - 32);
  ctx.fillText(EVENT.url.toLowerCase(), cx, frameBottom - 14);
  ctx.restore();

  cardFooter(ctx, cx, y + h - 26, 14);
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
function drawLockup(ctx: Ctx, cx: number, cy: number, maxW: number) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = COLORS.ink;
  let size = 120;
  ctx.font = font(FONTS.display, size, 900);
  size = Math.round((size * maxW) / ctx.measureText("HACKER").width);
  ctx.font = font(FONTS.display, size, 900);
  ctx.fillText("HACKER", cx, cy - size * 0.44);
  ctx.fillText("HOUSE", cx, cy + size * 0.44);
  ctx.restore();

  devaBadge(ctx, cx, cy - size * 0.02, size * 0.74, { rotate: -0.06, glow: false });

  ctx.save();
  ctx.fillStyle = COLORS.inkSoft;
  ctx.font = font(FONTS.body, 18, 700);
  ctx.textAlign = "center";
  trackedText(ctx, "GOA 2026", cx, cy + size * 1.15, 4, "center");
  ctx.restore();
}

/* ------------------------------------------------------------------ entry */

/** Aspect ratio of the supplied photo, or null when there isn't one yet. */
export function aspectOf(photo: CanvasImageSource | null): number | null {
  if (!photo) return null;
  const w = (photo as HTMLImageElement).width;
  const h = (photo as HTMLImageElement).height;
  return w > 0 && h > 0 ? w / h : null;
}

export function renderIdCard(
  ctx: Ctx,
  env: RenderEnv,
  data: CardData,
  face: CardFace,
  logo: CanvasImageSource | null = null,
) {
  // Both faces are laid out from the same geometry, so flipping never changes
  // the card's silhouette even when a tall photo has grown it.
  const L = cardLayout(aspectOf(data.photo), data.transform.fit);
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  poster(ctx);
  if (face === "front") drawFront(ctx, env, data, L);
  else drawBack(ctx, logo, L);
  // Drawn last so the snap hook passes in front of the card and into its punch
  // slot, the way the clip actually hangs.
  lanyard(ctx, W / 2, L.y, 1.45);
  ctx.restore();
}

export const ID_CARD_SIZE = { w: W, h: H };

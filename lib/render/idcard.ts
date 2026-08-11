import { CANVAS, COLORS, EVENT, FONTS } from "../brand";
import { activeIconsFor } from "../builderTitle";
import {
  barcode,
  bottomWordmark,
  cardFooter,
  cardShell,
  decorations,
  iconColumn,
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

const CARD_W = 524;
const CARD_R = 30;
const PAD = 40;
const CHIP = 42;
const CHIP_GAP = 16;

/** Height of the five stacked discipline chips — the row's natural minimum. */
const CHIP_COL_H = CHIP * 5 + CHIP_GAP * 4;

/** "BUILDER ID" is fixed text, so its size is a constant, not a fit-at-runtime. */
const TITLE_SIZE = 74;
/** Card top → top of the photo/icon row. */
const HEADER_H = 104 + Math.round(TITLE_SIZE * 0.96) + 24;
/** Bottom of the photo/icon row → card bottom (identity block + meta + footer). */
const FOOTER_H = 337;

const CARD_X = (W - CARD_W) / 2;
const CONTENT_LEFT = CARD_X + PAD;
const CONTENT_RIGHT = CARD_X + CARD_W - PAD;
const RULE_X = CONTENT_LEFT + CHIP + 26;
const PHOTO_X = RULE_X + 24;

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
  const rowH = Math.max(CHIP_COL_H, photo.h);
  const h = HEADER_H + rowH + FOOTER_H;
  // Anchor the card's bottom near the GOA 2026 wordmark, then clamp the top so
  // a tall card never rides up into the mirrored headline.
  const y = clamp(1174 - h, 340, 404);
  return { x: CARD_X, y, w: CARD_W, h, r: CARD_R, rowH, photo };
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
function poster(ctx: Ctx, cardTop: number) {
  posterBackground(ctx, W, H);
  mirroredHeadline(ctx, W, { top: -18 });
  bottomWordmark(ctx, W, H);
  decorations(ctx, W, H, {
    yellowBurst: [W * 0.2, H * 0.425, W * 0.17],
    pinkBurst: [W * 0.735, H * 0.7, W * 0.05],
    squiggle: [W * 0.025, H * 0.63, W * 0.26],
    deva: [W * 0.868, H * 0.44, 122],
  });
  lanyard(ctx, W / 2, cardTop, 1.18);
}

/* ------------------------------------------------------------- front face */

function drawFront(ctx: Ctx, env: RenderEnv, data: CardData, L: CardLayout) {
  const { x, y, w, h, r, rowH } = L;
  cardShell(ctx, x, y, w, h, r);

  const left = CONTENT_LEFT;
  const right = CONTENT_RIGHT;
  const innerW = right - left;

  /* header ------------------------------------------------------------- */
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.ink;
  ctx.font = font(FONTS.display, 28, 900);
  trackedText(ctx, EVENT.name, left, y + 104, 0.6);

  ctx.font = font(FONTS.display, TITLE_SIZE, 900);
  trackedText(ctx, "BUILDER ID", left, y + 104 + Math.round(TITLE_SIZE * 0.96), 1);
  ctx.restore();

  const rowTop = y + HEADER_H;

  /* icon column + photo ------------------------------------------------ */
  // Both the chips and the photo are centred in the row, so a short (wide) or
  // tall photo stays optically aligned with the column beside it.
  const colTop = rowTop + (rowH - CHIP_COL_H) / 2;
  iconColumn(ctx, left, colTop, CHIP, CHIP_GAP, activeIconsFor(data.stack, data.role));

  // hairline rule separating the chips from the portrait
  ctx.save();
  ctx.strokeStyle = "rgba(58,42,26,0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(RULE_X, rowTop + 2);
  ctx.lineTo(RULE_X, rowTop + rowH - 2);
  ctx.stroke();
  ctx.restore();

  // A window narrower than the available space (tall photo) is centred in it,
  // so the card stays balanced rather than leaning left.
  drawPortrait(
    ctx,
    data,
    PHOTO_X + (PHOTO_MAX_W - L.photo.w) / 2,
    rowTop + (rowH - L.photo.h) / 2,
    L.photo.w,
    L.photo.h,
  );

  /* identity block ----------------------------------------------------- */
  // The bottom row is pinned to the card, so the identity block gets whatever
  // vertical budget is left — it can never run into the barcode.
  const metaTop = y + h - 112;
  let cy = rowTop + rowH + 56;
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = COLORS.ink;

  const displayName = (data.name.trim() || "YOUR NAME").toUpperCase();
  fitFontSize(ctx, displayName, FONTS.display, 900, 50, 24, innerW, 0.5);
  trackedText(ctx, displayName, left, cy, 0.5);
  cy += 38;

  // STACK: <input>
  const labelSize = 20;
  ctx.font = font(FONTS.body, labelSize, 700);
  const stackLabelW = trackedText(ctx, "STACK:", left, cy, 0.8) + 9;
  ctx.font = font(FONTS.body, 23, 500);
  ctx.fillText(
    ellipsize(ctx, data.stack.trim() || "Add your stack", innerW - stackLabelW),
    left + stackLabelW,
    cy,
  );
  cy += 34;

  // role / title line
  ctx.font = font(FONTS.body, 26, 600);
  ctx.fillText(ellipsize(ctx, data.role.trim() || "Builder", innerW), left, cy);
  cy += 40;

  // BUILDER TITLE:
  ctx.font = font(FONTS.body, labelSize, 700);
  trackedText(ctx, "BUILDER TITLE:", left, cy, 0.8);
  cy += 31;
  ctx.font = font(FONTS.body, 26, 500);
  ctx.fillText(ellipsize(ctx, data.builderTitle, innerW), left, cy);
  ctx.restore();

  /* bottom row: barcode + meta ----------------------------------------- */
  const bcW = innerW * 0.46;
  barcode(ctx, env, barcodeValue(data), left, metaTop, bcW, 52);

  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = COLORS.ink;
  ctx.font = font(FONTS.body, 15, 600);
  const metaX = left + bcW + 22;
  ctx.strokeStyle = "rgba(58,42,26,0.4)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(metaX - 12, metaTop);
  ctx.lineTo(metaX - 12, metaTop + 52);
  ctx.stroke();
  [`DATES: ${EVENT.dates}`, `LOCATION: ${EVENT.location}`, `URL: ${EVENT.url}`].forEach(
    (line, i) => {
      ctx.fillText(line, metaX, metaTop + 14 + i * 19);
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
 * Quiet reverse: same shell, same lanyard, brand lockup centred, footer repeated.
 * If `logo` is supplied (public/brand/hhgoa-logo.png) it is used as-is; otherwise
 * the wordmark is drawn from the same type + motif system as everything else.
 */
function drawBack(ctx: Ctx, logo: CanvasImageSource | null, L: CardLayout) {
  const { x, y, w, h, r } = L;
  cardShell(ctx, x, y, w, h, r);

  // thin inset border
  ctx.save();
  ctx.strokeStyle = "rgba(58,42,26,0.4)";
  ctx.lineWidth = 2.5;
  roundRect(ctx, x + 26, y + 78, w - 52, h - 130, r * 0.6);
  ctx.stroke();
  ctx.restore();

  const cx = x + w / 2;
  const cy = y + h * 0.5;

  if (logo) {
    const iw = (logo as HTMLImageElement).width;
    const ih = (logo as HTMLImageElement).height;
    const maxW = w - 130;
    const maxH = h * 0.46;
    const s = Math.min(maxW / iw, maxH / ih);
    ctx.drawImage(logo, cx - (iw * s) / 2, cy - (ih * s) / 2, iw * s, ih * s);
  } else {
    drawLockup(ctx, cx, cy, w - 140);
  }

  ctx.save();
  ctx.fillStyle = COLORS.inkSoft;
  ctx.font = font(FONTS.body, 16, 600);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  trackedText(ctx, EVENT.dates + "  ·  " + EVENT.location, cx, y + h - 78, 1.2, "center");
  ctx.restore();

  cardFooter(ctx, cx, y + h - 30, 15);
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

  devaBadge(ctx, cx, cy, size * 0.62, { rotate: -0.06, glow: false, plate: false });

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
  poster(ctx, L.y);
  if (face === "front") drawFront(ctx, env, data, L);
  else drawBack(ctx, logo, L);
  ctx.restore();
}

export const ID_CARD_SIZE = { w: W, h: H };

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
  Ctx,
  devaBadge,
  drawCover,
  ellipsize,
  fitFontSize,
  font,
  roundRect,
  trackedText,
} from "./primitives";

export type PhotoTransform = { zoom: number; offsetX: number; offsetY: number };

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

/** Card geometry, shared by both faces so front and back read as one object. */
const CARD = {
  w: 524,
  h: 796,
  r: 30,
  get x() {
    return (W - this.w) / 2;
  },
  y: 362,
};

const PAD = 40;
const CHIP = 42;
const CHIP_GAP = 16;

/**
 * The portrait window's geometry, hoisted so the crop UI can present a viewport
 * with exactly the aspect ratio the card will render into.
 */
const PORTRAIT = (() => {
  const left = CARD.x + PAD;
  const right = CARD.x + CARD.w - PAD;
  const x = left + CHIP + 26 + 24;
  return { x, w: right - x, h: CHIP * 5 + CHIP_GAP * 4 };
})();

export const PORTRAIT_ASPECT = PORTRAIT.w / PORTRAIT.h;

/* ------------------------------------------------------------------ poster */

/**
 * Draws everything behind the card: green field, mirrored headline, starbursts,
 * squiggle, गोवा badge, GOA 2026 wordmark, lanyard strap and clip.
 */
function poster(ctx: Ctx) {
  posterBackground(ctx, W, H);
  mirroredHeadline(ctx, W, { top: -18 });
  bottomWordmark(ctx, W, H);
  decorations(ctx, W, H, {
    yellowBurst: [W * 0.2, H * 0.425, W * 0.17],
    pinkBurst: [W * 0.735, H * 0.7, W * 0.05],
    squiggle: [W * 0.025, H * 0.63, W * 0.26],
    deva: [W * 0.868, H * 0.44, 122],
  });
  lanyard(ctx, W / 2, CARD.y, 1.18);
}

/* ------------------------------------------------------------- front face */

function drawFront(ctx: Ctx, env: RenderEnv, data: CardData) {
  const { x, y, w, h, r } = { ...CARD, x: CARD.x };
  cardShell(ctx, x, y, w, h, r);

  const left = x + PAD;
  const right = x + w - PAD;
  const innerW = right - left;

  /* header ------------------------------------------------------------- */
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.ink;
  ctx.font = font(FONTS.display, 28, 900);
  trackedText(ctx, EVENT.name, left, y + 104, 0.6);

  const titleSize = fitFontSize(ctx, "BUILDER ID", FONTS.display, 900, 80, 48, innerW, 1);
  trackedText(ctx, "BUILDER ID", left, y + 104 + titleSize * 0.96, 1);
  ctx.restore();

  const rowTop = y + 104 + titleSize * 0.96 + 24;

  /* icon column + photo ------------------------------------------------ */
  const chip = CHIP;
  const chipGap = CHIP_GAP;
  const colH = PORTRAIT.h;
  iconColumn(ctx, left, rowTop, chip, chipGap, activeIconsFor(data.stack, data.role));

  // hairline rule separating the chips from the portrait
  const ruleX = left + chip + 26;
  ctx.save();
  ctx.strokeStyle = "rgba(58,42,26,0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ruleX, rowTop + 2);
  ctx.lineTo(ruleX, rowTop + colH - 2);
  ctx.stroke();
  ctx.restore();

  const photoX = ruleX + 24;
  const photoW = right - photoX;
  const photoH = colH;
  drawPortrait(ctx, data, photoX, rowTop, photoW, photoH);

  /* identity block ----------------------------------------------------- */
  // The bottom row is pinned to the card, so the identity block gets whatever
  // vertical budget is left — it can never run into the barcode.
  const metaTop = y + h - 112;
  let cy = rowTop + colH + 56;
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
    drawCover(ctx, data.photo, px, py, pw, ph, data.transform);
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
function drawBack(ctx: Ctx, logo: CanvasImageSource | null) {
  const { x, y, w, h, r } = { ...CARD, x: CARD.x };
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

export function renderIdCard(
  ctx: Ctx,
  env: RenderEnv,
  data: CardData,
  face: CardFace,
  logo: CanvasImageSource | null = null,
) {
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  poster(ctx);
  if (face === "front") drawFront(ctx, env, data);
  else drawBack(ctx, logo);
  ctx.restore();
}

export const ID_CARD_SIZE = { w: W, h: H };
export const CARD_RECT = { x: CARD.x, y: CARD.y, w: CARD.w, h: CARD.h };

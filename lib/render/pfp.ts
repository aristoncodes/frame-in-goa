import { CANVAS, COLORS, EVENT, FONTS } from "../brand";
import { NO_ASSETS, type BrandAssets } from "./assets";
import {
  Ctx,
  devaBadge,
  drawPhoto,
  font,
  grain,
  starburst,
  trackedWidth,
  type PhotoTransform,
} from "./primitives";

const S = CANVAS.pfp.w; // square
const TAU = Math.PI * 2;

export type PfpData = {
  photo: CanvasImageSource | null;
  transform: PhotoTransform;
};

/* ------------------------------------------------------------- geometry */

const CX = S / 2;
const CY = S / 2;
/** The ring's outer edge meets the square exactly, so X's circular crop of a
 *  profile picture lands on the ring rather than slicing through it. */
const OUTER_R = S / 2;
const GOLD_EDGE_R = OUTER_R - 9;
const BAND_OUTER_R = OUTER_R - 17;
const BAND_INNER_R = OUTER_R - 89;
const GOLD_INNER_R = BAND_INNER_R - 5;
const PINK_INNER_R = BAND_INNER_R - 13;
/** The circle the viewer actually sees the photo through. */
const PHOTO_R = BAND_INNER_R - 19;
const TEXT_R = (BAND_OUTER_R + BAND_INNER_R) / 2;

/**
 * The photo box. Exported so the crop UI can present the *same* box: previously
 * the control fitted the photo to the whole square while the ring hid its outer
 * 20%, so every result came out more zoomed-in than the user had positioned it.
 */
export const PFP_PHOTO_BOX = {
  x: CX - PHOTO_R,
  y: CY - PHOTO_R,
  size: PHOTO_R * 2,
};

/* ------------------------------------------------------------- renderer */

/**
 * 1:1 profile-picture frame in the HH Goa palette: a striped green field, a gold
 * outer edge, a deep-green band carrying the event name arced over the top and
 * the dates arced along the bottom, a hot-pink inner hairline, and the गोवा
 * sticker locked over the foot of the portrait.
 */
export function renderPfp(ctx: Ctx, data: PfpData, assets: BrandAssets = NO_ASSETS) {
  ctx.clearRect(0, 0, S, S);

  background(ctx);

  /* photo, sized to the circle it is actually seen through ---------------- */
  ctx.save();
  ctx.beginPath();
  ctx.arc(CX, CY, PHOTO_R, 0, TAU);
  ctx.clip();
  if (data.photo) {
    drawPhoto(
      ctx,
      data.photo,
      PFP_PHOTO_BOX.x,
      PFP_PHOTO_BOX.y,
      PFP_PHOTO_BOX.size,
      PFP_PHOTO_BOX.size,
      data.transform,
    );
  } else {
    placeholder(ctx);
  }
  // a touch of depth so the portrait sits inside the ring rather than on it
  const inner = ctx.createRadialGradient(CX, CY, PHOTO_R * 0.68, CX, CY, PHOTO_R);
  inner.addColorStop(0, "rgba(0,0,0,0)");
  inner.addColorStop(1, "rgba(11,63,39,0.34)");
  ctx.fillStyle = inner;
  ctx.fillRect(CX - PHOTO_R, CY - PHOTO_R, PHOTO_R * 2, PHOTO_R * 2);
  ctx.restore();

  ring(ctx);

  /* type on the band ------------------------------------------------------ */
  arcText(ctx, "HACKER HOUSE GOA", TEXT_R, S * 0.05, COLORS.gold, "top");
  arcText(ctx, `${EVENT.dates} · ${EVENT.location}`, TEXT_R, S * 0.036, COLORS.gold, "bottom");

  // small markers where the two arcs meet, left and right
  for (const angle of [0, Math.PI]) {
    diamond(ctx, CX + Math.cos(angle) * TEXT_R, CY + Math.sin(angle) * TEXT_R, S * 0.017);
  }

  /* गोवा sticker over the foot of the portrait ---------------------------- */
  devaBadge(ctx, CX, CY + PHOTO_R - S * 0.058, S * 0.075, {
    rotate: -0.05,
    glow: true,
    image: assets.goa,
  });
}

/* ---------------------------------------------------------- backdrop */

/** Striped green field with grain and a vignette — visible in the square PNG,
 *  cropped away by X, so it must look deliberate either way. */
function background(ctx: Ctx) {
  ctx.fillStyle = COLORS.green;
  ctx.fillRect(0, 0, S, S);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, S, S);
  ctx.clip();
  ctx.translate(CX, CY);
  ctx.rotate(-Math.PI / 4);
  ctx.translate(-S, -S);
  ctx.fillStyle = "rgba(255,255,255,0.032)";
  for (let x = 0; x < S * 2; x += 46) ctx.fillRect(x, 0, 23, S * 2);
  ctx.restore();

  const vig = ctx.createRadialGradient(CX, CY, S * 0.3, CX, CY, S * 0.72);
  vig.addColorStop(0, "rgba(26,107,68,0.35)");
  vig.addColorStop(1, "rgba(8,52,32,0.6)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, S, S);

  grain(ctx, 0, 0, S, S, 0.0007, 61, "rgba(255,255,255,0.05)", "rgba(0,0,0,0.08)");

  // corner accents, tucked so the ring overlaps them
  ctx.save();
  ctx.fillStyle = COLORS.gold;
  starburst(ctx, S * 0.055, S * 0.055, S * 0.05, S * 0.016, 8, 0.4, 12);
  ctx.fill();
  ctx.fillStyle = COLORS.pink;
  starburst(ctx, S * 0.95, S * 0.94, S * 0.042, S * 0.014, 8, 0.15, 5);
  ctx.fill();
  ctx.restore();
}

function placeholder(ctx: Ctx) {
  ctx.fillStyle = COLORS.greenLight;
  ctx.fillRect(CX - PHOTO_R, CY - PHOTO_R, PHOTO_R * 2, PHOTO_R * 2);
  ctx.fillStyle = "rgba(245,241,230,0.34)";
  ctx.beginPath();
  ctx.arc(CX, CY - PHOTO_R * 0.24, PHOTO_R * 0.32, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(CX, CY + PHOTO_R * 0.88, PHOTO_R * 0.58, PHOTO_R * 0.62, 0, Math.PI, 0);
  ctx.fill();
}

/* -------------------------------------------------------------- the ring */

function ring(ctx: Ctx) {
  ctx.save();

  // deep band the type sits on
  ctx.beginPath();
  ctx.arc(CX, CY, (BAND_OUTER_R + BAND_INNER_R) / 2, 0, TAU);
  ctx.strokeStyle = COLORS.greenDeep;
  ctx.lineWidth = BAND_OUTER_R - BAND_INNER_R;
  ctx.stroke();

  // grain over the band only
  ctx.save();
  ctx.beginPath();
  ctx.arc(CX, CY, BAND_OUTER_R, 0, TAU);
  ctx.arc(CX, CY, BAND_INNER_R, 0, TAU, true);
  ctx.clip("evenodd");
  grain(ctx, 0, 0, S, S, 0.0016, 23, "rgba(255,255,255,0.06)", "rgba(0,0,0,0.1)");
  ctx.restore();

  // gold outer edge
  ctx.beginPath();
  ctx.arc(CX, CY, GOLD_EDGE_R, 0, TAU);
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 17;
  ctx.stroke();

  // hairline just inside the gold, to give the edge weight
  ctx.beginPath();
  ctx.arc(CX, CY, BAND_OUTER_R - 3, 0, TAU);
  ctx.strokeStyle = COLORS.goldDeep;
  ctx.lineWidth = 3;
  ctx.stroke();

  // gold, then pink, closing on the portrait
  ctx.beginPath();
  ctx.arc(CX, CY, GOLD_INNER_R, 0, TAU);
  ctx.strokeStyle = COLORS.goldDeep;
  ctx.lineWidth = 5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(CX, CY, PINK_INNER_R, 0, TAU);
  ctx.strokeStyle = COLORS.pink;
  ctx.lineWidth = 11;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(CX, CY, PHOTO_R + 3, 0, TAU);
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
}

function diamond(ctx: Ctx, x: number, y: number, r: number) {
  ctx.save();
  ctx.fillStyle = COLORS.pink;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.62, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.62, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* -------------------------------------------------------------- arc type */

/**
 * Text set on a circular path. `bottom` runs the string left-to-right along the
 * underside of the circle, which means walking anticlockwise with each glyph
 * flipped — otherwise it reads upside down and backwards.
 */
function arcText(
  ctx: Ctx,
  text: string,
  radius: number,
  size: number,
  color: string,
  side: "top" | "bottom",
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = font(FONTS.display, size, 900);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const tracking = size * 0.16;
  const chars = [...text];
  const sweep = trackedWidth(ctx, text, tracking) / radius;
  const dir = side === "top" ? 1 : -1;
  const centre = side === "top" ? -Math.PI / 2 : Math.PI / 2;
  let angle = centre - (dir * sweep) / 2;

  for (const ch of chars) {
    const step = ((ctx.measureText(ch).width + tracking) / radius) * dir;
    const a = angle + step / 2;
    ctx.save();
    ctx.translate(CX + Math.cos(a) * radius, CY + Math.sin(a) * radius);
    ctx.rotate(a + (side === "top" ? Math.PI / 2 : -Math.PI / 2));
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    angle += step;
  }
  ctx.restore();
}

export const PFP_SIZE = { w: CANVAS.pfp.w, h: CANVAS.pfp.h };

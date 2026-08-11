import { CANVAS, COLORS, EVENT, FONTS } from "../brand";
import { sparkle } from "./motifs";
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

export type PfpData = {
  photo: CanvasImageSource | null;
  transform: PhotoTransform;
};

/**
 * 1:1 profile-picture frame. The photo fills the circle edge to edge; the frame
 * is a gold outer ring with a hot-pink inner hairline, "HACKER HOUSE GOA 2026"
 * arced along the top on a real text path, and the गोवा sticker locked at the
 * bottom. Deliberately light — it must read as a PFP ring, not a poster.
 */
export function renderPfp(ctx: Ctx, data: PfpData) {
  ctx.clearRect(0, 0, S, S);

  const cx = S / 2;
  const cy = S / 2;
  const outerR = S / 2;
  const ringW = S * 0.105;
  const photoR = outerR - ringW;

  /* photo ---------------------------------------------------------------- */
  // Filled edge to edge: X crops profile pictures to a circle, but the square
  // PNG the user downloads should never show empty corners.
  ctx.save();
  ctx.fillStyle = COLORS.green;
  ctx.fillRect(0, 0, S, S);
  if (data.photo) {
    drawPhoto(ctx, data.photo, 0, 0, S, S, data.transform);
  } else {
    ctx.fillStyle = COLORS.greenLight;
    ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = "rgba(245,241,230,0.35)";
    ctx.beginPath();
    ctx.arc(cx, cy - photoR * 0.22, photoR * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, cy + photoR * 0.86, photoR * 0.56, photoR * 0.6, 0, Math.PI, 0);
    ctx.fill();
  }
  // dim the square corners so the ring, not the leftover photo, reads as the edge
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, S, S);
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(11,63,39,0.82)";
  ctx.fill("evenodd");
  ctx.restore();
  ctx.restore();

  /* ring ----------------------------------------------------------------- */
  ctx.save();
  // green band the type sits on
  ctx.beginPath();
  ctx.arc(cx, cy, outerR - ringW / 2, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.green;
  ctx.lineWidth = ringW;
  ctx.stroke();

  // grain over the band only
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.arc(cx, cy, photoR, 0, Math.PI * 2, true);
  ctx.clip("evenodd");
  grain(ctx, 0, 0, S, S, 0.0012, 23, "rgba(255,255,255,0.05)", "rgba(0,0,0,0.09)");
  ctx.restore();

  // gold outer edge
  ctx.beginPath();
  ctx.arc(cx, cy, outerR - S * 0.008, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = S * 0.016;
  ctx.stroke();

  // hot-pink inner hairline hugging the photo
  ctx.beginPath();
  ctx.arc(cx, cy, photoR + S * 0.009, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.pink;
  ctx.lineWidth = S * 0.009;
  ctx.stroke();

  // thin gold line just outside the pink
  ctx.beginPath();
  ctx.arc(cx, cy, photoR + S * 0.021, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.goldDeep;
  ctx.lineWidth = S * 0.005;
  ctx.stroke();
  ctx.restore();

  /* arced wordmark along the top ---------------------------------------- */
  arcText(ctx, EVENT.name, cx, cy, outerR - ringW * 0.52, S * 0.052, COLORS.gold);

  /* गोवा sticker at the bottom of the ring ------------------------------ */
  const badgeR = ringW * 0.7;
  const badgeY = cy + outerR - badgeR - S * 0.012;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, badgeY, badgeR, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.green;
  ctx.fill();
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = S * 0.008;
  ctx.stroke();
  ctx.restore();
  devaBadge(ctx, cx, badgeY - S * 0.003, S * 0.066, { rotate: -0.05, glow: true });

  /* small accents on the band ------------------------------------------- */
  ctx.save();
  ctx.fillStyle = COLORS.gold;
  starburst(ctx, cx - outerR * 0.7, cy + outerR * 0.62, S * 0.032, S * 0.012, 8, 0.4, 12);
  ctx.fill();
  ctx.fillStyle = COLORS.pink;
  starburst(ctx, cx + outerR * 0.7, cy + outerR * 0.62, S * 0.026, S * 0.01, 8, 0.1, 4);
  ctx.fill();
  ctx.restore();
  sparkle(ctx, cx + outerR * 0.9, cy - outerR * 0.32, S * 0.018, COLORS.cream, 0.8);
  sparkle(ctx, cx - outerR * 0.9, cy - outerR * 0.34, S * 0.014, COLORS.cream, 0.6);
}

/** Text set on a circular path, centred at the top of the circle. */
function arcText(
  ctx: Ctx,
  text: string,
  cx: number,
  cy: number,
  radius: number,
  size: number,
  color: string,
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = font(FONTS.display, size, 900);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const tracking = size * 0.14;
  const chars = [...text];
  const total = trackedWidth(ctx, text, tracking);
  const sweep = total / radius; // radians
  let angle = -Math.PI / 2 - sweep / 2;

  for (const ch of chars) {
    const w = ctx.measureText(ch).width;
    const step = (w + tracking) / radius;
    ctx.save();
    ctx.translate(cx + Math.cos(angle + step / 2) * radius, cy + Math.sin(angle + step / 2) * radius);
    ctx.rotate(angle + step / 2 + Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    angle += step;
  }
  ctx.restore();
}

export const PFP_SIZE = { w: CANVAS.pfp.w, h: CANVAS.pfp.h };

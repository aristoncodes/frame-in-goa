/**
 * The team card: one landscape badge carrying a squad of two or three.
 *
 * Deliberately thin. The poster backdrop, the card shell, the lanyard, the
 * barcode and the studio footer are all the solo card's own functions, called
 * from here — this file only decides the landscape geometry and how the photo
 * collage is laid across it. Nothing about the solo Builder ID or the PFP frame
 * changes.
 *
 * A team has one name, not one per person: the team name is the headline, and
 * each builder contributes a face, their own name and their own title.
 */
import { COLORS, EVENT, FONTS } from "../brand";
import { NO_ASSETS, type BrandAssets } from "./assets";
import {
  barcode,
  bottomWordmark,
  cardFooter,
  cardShell,
  decorations,
  lanyard,
  LANYARD_BORE_R,
  mirroredHeadline,
  posterBackground,
  type RenderEnv,
} from "./motifs";
import {
  Ctx,
  DEFAULT_TRANSFORM,
  drawPhoto,
  ellipsize,
  fitFontSize,
  font,
  roundRect,
  trackedText,
  type PhotoTransform,
} from "./primitives";

/** One builder's place in the collage. */
export type TeamMember = {
  name: string;
  builderTitle: string;
  photo: CanvasImageSource | null;
  transform: PhotoTransform;
};

export type TeamData = { teamName: string; members: TeamMember[] };

/** Two or three. Below two it is not a team; above three the collage stops breathing. */
export const TEAM_MIN = 2;
export const TEAM_MAX = 3;

/** Landscape, where the solo poster is portrait — a squad reads across. */
export const TEAM_POSTER_SIZE = { w: 1350, h: 1080 };

const CARD_W = 1060;
const CARD_H = 600;
const CARD_R = 30;
const CARD_X = Math.round((TEAM_POSTER_SIZE.w - CARD_W) / 2);
/**
 * Low enough that the lanyard's tape runs off the poster's top edge rather than
 * beginning inside it, high enough to leave the GOA 2026 wordmark its band below.
 */
const CARD_Y = 400;
const PAD = 34;

/**
 * The collage window, fixed at 4:3 whatever the squad size. Constant so the crop
 * control previews the real window, and so two faces and three are cropped the
 * same way rather than one squad being framed tighter than another.
 */
const PHOTO_W = 320;
const PHOTO_H = 240;
const PHOTO_GAP = 16;
export const TEAM_PHOTO_ASPECT = PHOTO_W / PHOTO_H;

/** Card margin in the card-only crop, room enough for its own drop shadow. */
const CARD_ONLY_PAD = 40;
export const TEAM_CARD_ONLY_SIZE = {
  w: CARD_W + CARD_ONLY_PAD * 2,
  h: CARD_H + CARD_ONLY_PAD * 2,
};

function layout() {
  return {
    x: CARD_X,
    y: CARD_Y,
    w: CARD_W,
    h: CARD_H,
    r: CARD_R,
    punch: { cx: CARD_X + CARD_W / 2, cy: CARD_Y + 22, r: LANYARD_BORE_R },
  };
}

/* ------------------------------------------------------------------ poster */

/** Full composite: backdrop, team card, lanyard over the top. */
export function renderTeamPoster(
  ctx: Ctx,
  env: RenderEnv,
  data: TeamData,
  assets: BrandAssets = NO_ASSETS,
) {
  const L = layout();
  ctx.save();
  ctx.clearRect(0, 0, TEAM_POSTER_SIZE.w, TEAM_POSTER_SIZE.h);
  backdrop(ctx, assets);
  drawTeamCard(ctx, env, data, L, assets);
  lanyard(ctx, L.punch, assets.lanyard);
  ctx.restore();
}

/** The card alone on a transparent ground, cropped to its edges. */
export function renderTeamCardOnly(
  ctx: Ctx,
  env: RenderEnv,
  data: TeamData,
  assets: BrandAssets = NO_ASSETS,
) {
  const L = layout();
  ctx.save();
  ctx.clearRect(0, 0, TEAM_CARD_ONLY_SIZE.w, TEAM_CARD_ONLY_SIZE.h);
  ctx.translate(CARD_ONLY_PAD - L.x, CARD_ONLY_PAD - L.y);
  drawTeamCard(ctx, env, data, L, assets);
  ctx.restore();
}

/**
 * The same motifs as the solo poster, placed for this one.
 *
 * The card here is 78% of the poster's width, so there is no right-hand margin
 * to hang the गोवा badge in and no middle band for the bursts — at the solo
 * poster's fractions they all landed behind the card, the badge sliced in half by
 * its edge. Everything decorative therefore lives in the band above the card.
 *
 * The gold burst is left out entirely at the client's request; the solo poster
 * keeps its own.
 */
function backdrop(ctx: Ctx, assets: BrandAssets) {
  const { w, h } = TEAM_POSTER_SIZE;
  posterBackground(ctx, w, h);
  mirroredHeadline(ctx, w, { top: 4 });
  bottomWordmark(ctx, w, h);
  decorations(
    ctx,
    w,
    h,
    {
      pinkBurst: [w * 0.7, h * 0.075, w * 0.028],
      squiggle: [w * 0.03, h * 0.33, w * 0.14],
      deva: [w * 0.88, h * 0.215, 132],
    },
    assets.goa,
  );
}

/* -------------------------------------------------------------- the card */

type Layout = ReturnType<typeof layout>;

function drawTeamCard(
  ctx: Ctx,
  env: RenderEnv,
  data: TeamData,
  L: Layout,
  assets: BrandAssets,
) {
  const { x, y, w, h, r } = L;
  cardShell(ctx, x, y, w, h, r, L.punch);

  const left = x + PAD;
  const right = x + w - PAD;
  const innerW = right - left;
  const cx = x + w / 2;

  /* header: the event line, then the team's name as the headline ---------- */
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.ink;
  ctx.font = font(FONTS.display, 25, 900);
  trackedText(ctx, EVENT.name, left, y + 74, 0.5);

  ctx.font = font(FONTS.body, 15, 700);
  ctx.fillStyle = COLORS.inkSoft;
  trackedText(ctx, "TEAM", right, y + 74, 3, "right");

  const teamName = (data.teamName.trim() || "YOUR TEAM").toUpperCase();
  ctx.fillStyle = COLORS.ink;
  // The headline is the widest thing on the card, so it is fitted rather than set
  // at a fixed size — a long squad name shrinks instead of overrunning the edge.
  fitFontSize(ctx, teamName, FONTS.display, 900, 78, 30, innerW, 1);
  trackedText(ctx, ellipsize(ctx, teamName, innerW), left, y + 142, 1);
  ctx.restore();

  /* the collage ---------------------------------------------------------- */
  const members = data.members.slice(0, TEAM_MAX);
  const stripW = members.length * PHOTO_W + (members.length - 1) * PHOTO_GAP;
  const stripX = cx - stripW / 2;
  const stripY = y + 172;

  members.forEach((m, i) => {
    drawCollageCell(ctx, m, stripX + i * (PHOTO_W + PHOTO_GAP), stripY);
  });

  /* footer: barcode + meta + studio mark, as the solo card has it --------- */
  const metaTop = y + h - 106;
  const bcW = innerW * 0.32;
  barcode(ctx, env, barcodeValue(data), left, metaTop, bcW, 44);

  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = COLORS.ink;
  ctx.font = font(FONTS.body, 13, 600);
  const metaX = left + bcW + 18;
  ctx.strokeStyle = "rgba(58,42,26,0.4)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(metaX - 12, metaTop);
  ctx.lineTo(metaX - 11, metaTop + 44);
  ctx.stroke();
  ctx.fillText(`SQUAD: ${members.length} BUILDERS`, metaX, metaTop + 14);
  ctx.fillText(`${EVENT.dates} · ${EVENT.location}`, metaX, metaTop + 33);

  ctx.textAlign = "right";
  ctx.fillStyle = COLORS.inkSoft;
  ctx.font = font(FONTS.body, 12, 500);
  ctx.fillText("Non-transferable · carry it, don't laminate it", right, metaTop + 14);
  ctx.fillText(EVENT.url.toLowerCase(), right, metaTop + 33);
  ctx.restore();

  cardFooter(ctx, cx, y + h - 22, 14, assets.studio, env);
}

/** One collage cell: the framed window, then the name and title beneath it. */
function drawCollageCell(ctx: Ctx, m: TeamMember, x: number, y: number) {
  /* the window */
  ctx.save();
  roundRect(ctx, x, y, PHOTO_W, PHOTO_H, 12);
  ctx.fillStyle = "rgba(90,64,26,0.14)";
  ctx.fill();
  ctx.strokeStyle = "rgba(58,42,26,0.45)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  const mat = 8;
  ctx.save();
  roundRect(ctx, x + mat, y + mat, PHOTO_W - mat * 2, PHOTO_H - mat * 2, 8);
  ctx.clip();
  if (m.photo) {
    drawPhoto(
      ctx,
      m.photo,
      x + mat,
      y + mat,
      PHOTO_W - mat * 2,
      PHOTO_H - mat * 2,
      m.transform,
      COLORS.kraft,
    );
  } else {
    placeholder(ctx, x + mat, y + mat, PHOTO_W - mat * 2, PHOTO_H - mat * 2);
  }
  ctx.restore();

  /* name + title, centred under the window */
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = COLORS.ink;
  const mid = x + PHOTO_W / 2;
  const name = (m.name.trim() || "YOUR NAME").toUpperCase();
  fitFontSize(ctx, name, FONTS.display, 900, 30, 16, PHOTO_W, 0.5);
  trackedText(ctx, ellipsize(ctx, name, PHOTO_W), mid, y + PHOTO_H + 38, 0.5, "center");

  ctx.fillStyle = COLORS.inkSoft;
  ctx.font = font(FONTS.body, 15, 500);
  ctx.fillText(ellipsize(ctx, m.builderTitle, PHOTO_W), mid, y + PHOTO_H + 64);
  ctx.restore();
}

/** Stand-in bust, so an empty slot still reads as a person's place. */
function placeholder(ctx: Ctx, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.fillStyle = "rgba(58,42,26,0.16)";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "rgba(58,42,26,0.3)";
  const cx = x + w / 2;
  ctx.beginPath();
  ctx.arc(cx, y + h * 0.38, h * 0.19, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, y + h * 1.05, w * 0.24, h * 0.4, 0, Math.PI, 0);
  ctx.fill();
  ctx.restore();
}

/** CODE128 payload: short, stable, and different for every roster. */
function barcodeValue(data: TeamData) {
  const base = `TEAM${data.teamName}${data.members.map((m) => m.name || "BUILDER").join("|")}`;
  let hash = 0;
  for (let i = 0; i < base.length; i++) hash = (hash * 31 + base.charCodeAt(i)) >>> 0;
  return `HHG26-T${data.members.length}-${hash.toString(36).toUpperCase().padStart(6, "0").slice(0, 6)}`;
}

/** A blank slot, so the UI can seed the roster without knowing this file's shape. */
export function emptyMember(): TeamMember {
  return {
    name: "",
    builderTitle: "Your Builder Title",
    photo: null,
    transform: DEFAULT_TRANSFORM,
  };
}

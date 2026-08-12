/**
 * Offline render harness.
 *
 * Renders every generator output to scripts/out/*.png using the exact same
 * renderer modules the browser uses, so the composition can be inspected and
 * iterated on without a browser. Run: npm run preview
 */
import { createCanvas, GlobalFonts, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FONTS } from "../lib/brand";
import { generateBuilderTitle } from "../lib/builderTitle";
import {
  CARD_ONLY_SIZE,
  ID_CARD_SIZE,
  renderCardOnly,
  renderIdCard,
  type CardData,
} from "../lib/render/idcard";
import { DEFAULT_TRANSFORM } from "../lib/render/primitives";
import { renderPfp, PFP_SIZE } from "../lib/render/pfp";
import {
  emptyMember,
  renderTeamCardOnly,
  renderTeamPoster,
  TEAM_POSTER_SIZE,
  TEAM_CARD_ONLY_SIZE,
  type TeamMember,
} from "../lib/render/team";
import type { RenderEnv } from "../lib/render/motifs";
import { NO_ASSETS, type BrandAssets } from "../lib/render/assets";
import type { Ctx } from "../lib/render/primitives";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "scripts", "out");
fs.mkdirSync(outDir, { recursive: true });

for (const [file, family] of [
  ["Imbue.woff2", FONTS.display],
  ["VictorMono.woff2", FONTS.body],
] as const) {
  GlobalFonts.registerFromPath(path.join(root, "public", "fonts", file), family);
}

/** The same official marks the browser loads, so previews match production. */
const assets: BrandAssets = { ...NO_ASSETS };
for (const [key, file] of [
  ["goa", "goa-hindi.png"],
  ["studio", "studio-247.png"],
  ["wordmark", "hacker-house.png"],
  ["lanyard", "lanyard.png"],
  ["backLockup", "back-lockup.png"],
] as const) {
  const p = path.join(root, "public", "brand", file);
  if (fs.existsSync(p)) {
    assets[key] = (await loadImage(fs.readFileSync(p))) as unknown as CanvasImageSource;
  }
}

const env: RenderEnv = {
  createCanvas: (w, h) => {
    const c = createCanvas(w, h);
    return { canvas: c as unknown as CanvasImageSource, ctx: c.getContext("2d") as unknown as Ctx };
  },
};

/** Synthetic test photo at an arbitrary aspect ratio with an off-centre subject. */
function testPhoto(w: number, h: number, label: string) {
  const c = createCanvas(w, h);
  const ctx = c.getContext("2d") as SKRSContext2D;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#2b3f55");
  g.addColorStop(1, "#8a5a3b");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // off-centre "subject"
  const cx = w * 0.34;
  const cy = h * 0.4;
  const r = Math.min(w, h) * 0.2;
  ctx.fillStyle = "#e8c9a8";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1d2a33";
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 2.1, r * 1.5, r * 1.6, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `700 ${Math.round(Math.min(w, h) * 0.07)}px sans-serif`;
  ctx.fillText(label, 14, h - 18);
  // corner ticks so cropping behaviour is obvious
  ctx.strokeStyle = "#ff3b3b";
  ctx.lineWidth = Math.max(3, Math.min(w, h) * 0.012);
  ctx.strokeRect(0, 0, w, h);
  return c as unknown as CanvasImageSource;
}

function write(name: string, canvas: { toBuffer: (m: "image/png") => Buffer }) {
  const p = path.join(outDir, name);
  fs.writeFileSync(p, canvas.toBuffer("image/png"));
  console.log("→", path.relative(root, p));
}

const base: Omit<CardData, "photo"> = {
  name: "Aryan Chauhan",
  team: "Midnight Shippers",
  role: "Founding Engineer",
  builderTitle: generateBuilderTitle("Aryan Chauhan", "Web3 / AI / Build", "Founding Engineer"),
  transform: DEFAULT_TRANSFORM,
};

const COVER = { ...DEFAULT_TRANSFORM, fit: "cover" as const };

const cases: { name: string; photo: CanvasImageSource | null; data?: Partial<CardData> }[] = [
  { name: "front-portrait", photo: testPhoto(900, 1400, "portrait 9:14") },
  { name: "front-portrait-cover", photo: testPhoto(900, 1400, "portrait 9:14"), data: { transform: COVER } },
  { name: "front-landscape", photo: testPhoto(1600, 900, "landscape 16:9") },
  { name: "front-ultrawide", photo: testPhoto(2000, 640, "ultrawide 25:8") },
  { name: "front-square-longname", photo: testPhoto(1000, 1000, "square"), data: { name: "Bhaskaracharya Venkataraman", team: "Kubernetes Terraform Platform Crew", role: "Staff Site Reliability Engineer" } },
  { name: "front-empty", photo: null, data: { name: "", team: "", role: "", builderTitle: "Your Builder Title" } },
  // Long-name stress cases
  { name: "name-long", photo: testPhoto(1200, 1500, "3:4"), data: { name: "Bompelliwar Saikiran", team: "Go Postgres Kafka", role: "Backend Engineer" } },
  { name: "name-longer", photo: testPhoto(1200, 1500, "3:4"), data: { name: "Venkatanarasimharajuvaripeta Srinivasulu", team: "Rust", role: "Systems" } },
  { name: "name-unbroken", photo: testPhoto(1200, 1500, "3:4"), data: { name: "Bompelliwarsaikiranvenkateswarlu", team: "Rust", role: "Systems" } },
  // The size the user reported breaking the layout.
  { name: "user-352x290", photo: testPhoto(352, 290, "352x290") },
];

for (const c of cases) {
  const canvas = createCanvas(ID_CARD_SIZE.w, ID_CARD_SIZE.h);
  const ctx = canvas.getContext("2d") as unknown as Ctx;
  const data = { ...base, ...c.data, photo: c.photo } as CardData;
  if (c.data?.name !== undefined && c.data.builderTitle === undefined) {
    data.builderTitle = generateBuilderTitle(data.name, data.team, data.role);
  }
  renderIdCard(ctx, env, data, "front", assets);
  write(`${c.name}.png`, canvas);
}

for (const [label, photo] of [
  ["back", null],
  // Same tall photo as front-portrait: the back must share that silhouette.
  ["back-portrait", testPhoto(900, 1400, "portrait 9:14")],
] as const) {
  const canvas = createCanvas(ID_CARD_SIZE.w, ID_CARD_SIZE.h);
  const ctx = canvas.getContext("2d") as unknown as Ctx;
  renderIdCard(ctx, env, { ...base, photo } as CardData, "back", assets);
  write(`${label}.png`, canvas);
}

// The card-only crop, both faces. These are what the "Card only" download
// produces: the card on a transparent ground, nothing behind it.
for (const face of ["front", "back"] as const) {
  const canvas = createCanvas(CARD_ONLY_SIZE.w, CARD_ONLY_SIZE.h);
  const ctx = canvas.getContext("2d") as unknown as Ctx;
  renderCardOnly(
    ctx,
    env,
    { ...base, photo: face === "front" ? testPhoto(900, 1400, "portrait") : null } as CardData,
    face,
    assets,
  );
  write(`cardonly-${face}.png`, canvas);
}

// Team mode: two and three builders, poster and card-only.
const TEAM_NAME = "Midnight Shippers";
const roster: TeamMember[] = [
  { name: "Aryan Chauhan", photo: testPhoto(900, 1200, "A") },
  { name: "Meera Nair", photo: testPhoto(1200, 900, "B") },
  { name: "Bompelliwar Saikiran", photo: testPhoto(1000, 1000, "C") },
].map((m) => ({
  ...emptyMember(),
  name: m.name,
  photo: m.photo as unknown as CanvasImageSource,
  builderTitle: generateBuilderTitle(m.name, TEAM_NAME, "Builder"),
}));

for (const n of [2, 3] as const) {
  const members = roster.slice(0, n);
  const data = { teamName: TEAM_NAME, members };
  const p = createCanvas(TEAM_POSTER_SIZE.w, TEAM_POSTER_SIZE.h);
  renderTeamPoster(p.getContext("2d") as unknown as Ctx, env, data, assets);
  write(`team-${n}.png`, p);

  const co = createCanvas(TEAM_CARD_ONLY_SIZE.w, TEAM_CARD_ONLY_SIZE.h);
  renderTeamCardOnly(co.getContext("2d") as unknown as Ctx, env, data, assets);
  write(`team-${n}-cardonly.png`, co);
}

// An empty roster must still render: no photos, no names.
{
  const members = [emptyMember(), emptyMember(), emptyMember()];
  const p = createCanvas(TEAM_POSTER_SIZE.w, TEAM_POSTER_SIZE.h);
  renderTeamPoster(p.getContext("2d") as unknown as Ctx, env, { teamName: "", members }, assets);
  write("team-empty.png", p);
}

for (const [label, photo, t] of [
  ["pfp-portrait", testPhoto(900, 1400, "portrait"), DEFAULT_TRANSFORM],
  ["pfp-portrait-cover", testPhoto(900, 1400, "portrait"), COVER],
  ["pfp-landscape", testPhoto(1600, 900, "landscape"), DEFAULT_TRANSFORM],
] as const) {
  const canvas = createCanvas(PFP_SIZE.w, PFP_SIZE.h);
  const ctx = canvas.getContext("2d") as unknown as Ctx;
  renderPfp(ctx, { photo, transform: t }, assets);
  write(`${label}.png`, canvas);
}

console.log("\nBuilder title samples:");
for (const [n, s, r] of [
  ["Aryan Chauhan", "Web3 / AI / Build", "Founding Engineer"],
  ["Meera Nair", "React, Next.js, Tailwind", "Frontend Dev"],
  ["Sam Okoro", "Rust, distributed systems", "Backend"],
  ["Priya S", "watercolour and bread", "Hobbyist"],
  ["Dev Patel", "LLM agents, RAG", "AI Engineer"],
] as const) {
  console.log(` ${n.padEnd(18)} → ${generateBuilderTitle(n, s, r)}`);
}

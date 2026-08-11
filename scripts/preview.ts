/**
 * Offline render harness.
 *
 * Renders every generator output to scripts/out/*.png using the exact same
 * renderer modules the browser uses, so the composition can be inspected and
 * iterated on without a browser. Run: npm run preview
 */
import { createCanvas, GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FONTS } from "../lib/brand";
import { generateBuilderTitle } from "../lib/builderTitle";
import { renderIdCard, ID_CARD_SIZE, type CardData } from "../lib/render/idcard";
import { DEFAULT_TRANSFORM } from "../lib/render/primitives";
import { renderPfp, PFP_SIZE } from "../lib/render/pfp";
import type { RenderEnv } from "../lib/render/motifs";
import type { Ctx } from "../lib/render/primitives";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "scripts", "out");
fs.mkdirSync(outDir, { recursive: true });

for (const [file, family] of [
  ["Fraunces-Display.woff2", FONTS.display],
  ["YatraOne.woff2", FONTS.deva],
  ["Inter.woff2", FONTS.body],
] as const) {
  GlobalFonts.registerFromPath(path.join(root, "public", "fonts", file), family);
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
  stack: "Web3 / AI / Build",
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
  { name: "front-square-longname", photo: testPhoto(1000, 1000, "square"), data: { name: "Bhaskaracharya Venkataraman", stack: "Kubernetes / Terraform / Platform Engineering", role: "Staff Site Reliability Engineer" } },
  { name: "front-empty", photo: null, data: { name: "", stack: "", role: "", builderTitle: "Your Builder Title" } },
  // Long-name stress cases
  { name: "name-long", photo: testPhoto(1200, 1500, "3:4"), data: { name: "Bompelliwar Saikiran", stack: "Go, Postgres, Kafka", role: "Backend Engineer" } },
  { name: "name-longer", photo: testPhoto(1200, 1500, "3:4"), data: { name: "Venkatanarasimharajuvaripeta Srinivasulu", stack: "Rust", role: "Systems" } },
  { name: "name-unbroken", photo: testPhoto(1200, 1500, "3:4"), data: { name: "Bompelliwarsaikiranvenkateswarlu", stack: "Rust", role: "Systems" } },
  // The size the user reported breaking the layout.
  { name: "user-352x290", photo: testPhoto(352, 290, "352x290") },
];

for (const c of cases) {
  const canvas = createCanvas(ID_CARD_SIZE.w, ID_CARD_SIZE.h);
  const ctx = canvas.getContext("2d") as unknown as Ctx;
  const data = { ...base, ...c.data, photo: c.photo } as CardData;
  if (c.data?.name !== undefined && c.data.builderTitle === undefined) {
    data.builderTitle = generateBuilderTitle(data.name, data.stack, data.role);
  }
  renderIdCard(ctx, env, data, "front");
  write(`${c.name}.png`, canvas);
}

for (const [label, photo] of [
  ["back", null],
  // Same tall photo as front-portrait: the back must share that silhouette.
  ["back-portrait", testPhoto(900, 1400, "portrait 9:14")],
] as const) {
  const canvas = createCanvas(ID_CARD_SIZE.w, ID_CARD_SIZE.h);
  const ctx = canvas.getContext("2d") as unknown as Ctx;
  renderIdCard(ctx, env, { ...base, photo } as CardData, "back");
  write(`${label}.png`, canvas);
}

for (const [label, photo, t] of [
  ["pfp-portrait", testPhoto(900, 1400, "portrait"), DEFAULT_TRANSFORM],
  ["pfp-portrait-cover", testPhoto(900, 1400, "portrait"), COVER],
  ["pfp-landscape", testPhoto(1600, 900, "landscape"), DEFAULT_TRANSFORM],
] as const) {
  const canvas = createCanvas(PFP_SIZE.w, PFP_SIZE.h);
  const ctx = canvas.getContext("2d") as unknown as Ctx;
  renderPfp(ctx, { photo, transform: t });
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

/**
 * Generates the deterministic image fixtures the e2e suite drives the app with.
 * `corners.png` carries a pure-magenta block in each corner: if all four survive
 * into the output, nothing was cropped.
 */
import { createCanvas } from "@napi-rs/canvas";
import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "fixtures");
fs.mkdirSync(dir, { recursive: true });

const W = 1600;
const H = 900;
const c = createCanvas(W, H);
const ctx = c.getContext("2d");

const g = ctx.createLinearGradient(0, 0, W, H);
g.addColorStop(0, "#2b3f55");
g.addColorStop(1, "#8a5a3b");
ctx.fillStyle = g;
ctx.fillRect(0, 0, W, H);

ctx.fillStyle = "#e8c9a8";
ctx.beginPath();
ctx.arc(W * 0.5, H * 0.42, H * 0.2, 0, Math.PI * 2);
ctx.fill();

const m = Math.round(Math.min(W, H) * 0.11);
ctx.fillStyle = "#FF00FF";
for (const [x, y] of [
  [0, 0],
  [W - m, 0],
  [0, H - m],
  [W - m, H - m],
]) {
  ctx.fillRect(x, y, m, m);
}

fs.writeFileSync(path.join(dir, "corners.png"), c.toBuffer("image/png"));
console.log(`corners.png ${W}x${H}, ${m}px corner markers`);

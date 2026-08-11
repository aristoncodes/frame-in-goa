/** Proves the white-knockout + composite path before real artwork arrives. */
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { FONTS } from "../lib/brand";
import { lanyard } from "../lib/render/motifs";
import type { Ctx } from "../lib/render/primitives";

const root = process.cwd();
for (const [f, fam] of [["Imbue.woff2", FONTS.display], ["YatraOne.woff2", FONTS.deva], ["VictorMono.woff2", FONTS.body]] as const) {
  GlobalFonts.registerFromPath(path.join(root, "public/fonts", f), fam);
}

// Stand-in "photo": the drawn lanyard on a white field, as a supplied image would be.
const src = createCanvas(600, 900);
const sctx = src.getContext("2d") as unknown as Ctx;
sctx.fillStyle = "#ffffff";
sctx.fillRect(0, 0, 600, 900);
lanyard(sctx, 300, 860, 1.6);
const tmp = path.join(root, "scripts", "out", "lanyard-src.png");
fs.writeFileSync(tmp, src.toBuffer("image/png"));

execSync(`npx tsx scripts/prepare-lanyard.mts ${JSON.stringify(tmp)}`, { stdio: "inherit" });

const out = path.join(root, "public", "brand", "lanyard.png");
const img = await loadImage(fs.readFileSync(out));
const c = createCanvas(img.width, img.height);
const ctx = c.getContext("2d");
ctx.drawImage(img, 0, 0);
const d = ctx.getImageData(0, 0, img.width, img.height).data;
let clear = 0, solid = 0;
for (let i = 3; i < d.length; i += 4) {
  if (d[i] < 8) clear++;
  else if (d[i] > 200) solid++;
}
const total = img.width * img.height;
console.log(`transparent ${(clear / total * 100).toFixed(1)}%  opaque ${(solid / total * 100).toFixed(1)}%`);

const ok = clear / total > 0.25 && solid / total > 0.1;
console.log(ok ? "\nPASS  white knocked out, artwork kept" : "\nFAIL  knockout looks wrong");
fs.rmSync(tmp, { force: true });
fs.rmSync(out, { force: true });
process.exit(ok ? 0 : 1);

/**
 * Confirms the crop control and the rendered PFP frame the photo identically:
 * a marker drawn at a known spot in the source must land at the same relative
 * position in both the control's canvas and the output canvas.
 */
import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";

const out = path.join(process.cwd(), "scripts", "out", "e2e");
fs.mkdirSync(out, { recursive: true });

const b = await chromium.launch();
const p = await (await b.newContext({ ...devices["iPhone 13"] })).newPage();
await p.goto("http://localhost:3000", { waitUntil: "networkidle" });
await p.waitForFunction(() => document.fonts.check('900 100px "Fraunces-Display"'));
await p.getByRole("tab", { name: "PFP Frame" }).click();
await p.setInputFiles('input[type="file"]', "./fixtures/bar.png");
await p.waitForSelector("text=POSITION YOUR PHOTO");
await p.getByRole("radio", { name: "Whole photo" }).click();
await p.waitForTimeout(700);

/**
 * Width of the marker bar as a fraction of the *visible circle*, which is what
 * the two surfaces must agree on. The control's circle is its whole canvas; the
 * output's is the ring's inner opening, passed in as `circle`.
 */
const spread = (idx: number, radius: number, dyFrac: number) =>
  p.evaluate(
    ({ i, radius, dyFrac }) => {
      const c = document.querySelectorAll("canvas")[i] as HTMLCanvasElement;
      const { width: w, height: h } = c;
      const d = c.getContext("2d")!.getImageData(0, 0, w, h).data;
      // Scan off the vertical centre: the ring's left/right marker diamonds sit
      // exactly on it and would otherwise be counted as photo.
      const dy = Math.round(radius * dyFrac);
      const y = Math.floor(h / 2) + dy;
      let minX = 1e9, maxX = -1;
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        // hue test: magenta has red and blue well above green, and it survives
        // the vignette that darkens the portrait toward its edge
        if (d[o] > d[o + 1] + 45 && d[o + 2] > d[o + 1] + 45) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
      }
      if (maxX < 0) return null;
      // Compare against the circle's chord at this row, not its diameter.
      const chord = 2 * Math.sqrt(radius * radius - dy * dy);
      return (maxX - minX) / chord;
    },
    { i: idx, radius, dyFrac },
  );

const ctlCanvas = await p.evaluate(
  () => (document.querySelectorAll("canvas")[1] as HTMLCanvasElement).width,
);
const DY = 0.12;
// Output: the ring's inner opening. Control: the whole square canvas.
const preview = await spread(0, 432, DY);
const control = await spread(1, ctlCanvas / 2, DY);
console.log(`output  bar / circle chord: ${preview?.toFixed(3)}`);
console.log(`control bar / circle chord: ${control?.toFixed(3)}`);

fs.writeFileSync(path.join(out, "pfp-new.png"), await p.locator("canvas").first().screenshot());
await p.screenshot({ path: path.join(out, "pfp-mobile.png"), fullPage: true });

if (preview && control && Math.abs(preview - control) < 0.04) {
  console.log("\nPASS  control and output frame the photo identically");
} else {
  console.log(`\nFAIL  control and output disagree (${control} vs ${preview})`);
  process.exit(1);
}
await b.close();

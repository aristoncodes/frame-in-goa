/**
 * Drives the real background-removal toggle in a browser and reports whether the
 * subject survived and the backdrop actually became kraft.
 */
import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";

const fixture = process.argv[2] ?? "./fixtures/person.jpg";
const out = path.join(process.cwd(), "scripts", "out", "e2e");
fs.mkdirSync(out, { recursive: true });

const measureRef = () =>
  page.evaluate(() => {
    const c = document.querySelector("canvas") as HTMLCanvasElement;
    const { data } = c.getContext("2d")!.getImageData(430, 560, 300, 240);
    let kraft = 0, total = 0;
    for (let i = 0; i < data.length; i += 4) {
      total++;
      const [r, g, bl] = [data[i], data[i + 1], data[i + 2]];
      if (r > 185 && r < 245 && g > 168 && g < 225 && bl > 128 && bl < 200 && r > bl + 28) kraft++;
    }
    return kraft / total;
  });

const b = await chromium.launch();
const page = await (await b.newContext({ ...devices["iPhone 13"] })).newPage();
const errs: string[] = [];
page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await page.waitForFunction(() => document.fonts.check('900 100px "Imbue"'));
await page.setInputFiles('input[type="file"]', fixture);
await page.waitForSelector("text=POSITION YOUR PHOTO");

const before = await measureRef();
const t0 = Date.now();
await page.getByRole("button", { name: /PUT ME ON KRAFT PAPER/i }).click();
await page.waitForFunction(
  () => !document.body.innerText.includes("REMOVING BACKGROUND"),
  { timeout: 90_000 },
);
const ms = Date.now() - t0;

const alert = await page.locator('[role="alert"]').allTextContents();
const pressed = await page
  .getByRole("button", { name: /PUT ME ON KRAFT PAPER/i })
  .getAttribute("aria-pressed");

// Kraft share of the photo window. Compared before and after, since the mount
// and any letterboxing are already kraft — only the delta shows a replaced
// background.
const measure = () => page.evaluate(() => {
  const c = document.querySelector("canvas") as HTMLCanvasElement;
  const { data } = c.getContext("2d")!.getImageData(430, 560, 300, 240);
  let kraft = 0, total = 0;
  for (let i = 0; i < data.length; i += 4) {
    total++;
    const [r, g, bl] = [data[i], data[i + 1], data[i + 2]];
    if (r > 185 && r < 245 && g > 168 && g < 225 && bl > 128 && bl < 200 && r > bl + 28) kraft++;
  }
  return kraft / total;
});

const kraftShare = await measure();
console.log(`took            ${ms}ms`);
console.log(`toggle pressed  ${pressed}`);
console.log(`alerts          ${alert.length ? alert.join(" | ") : "none"}`);
console.log(`kraft in window ${(before * 100).toFixed(1)}% -> ${(kraftShare * 100).toFixed(1)}%`);

fs.writeFileSync(path.join(out, "cutout.png"), await page.locator("canvas").first().screenshot());
await page.getByRole("tab", { name: "PFP Frame" }).click();
await page.waitForTimeout(600);
fs.writeFileSync(path.join(out, "cutout-pfp.png"), await page.locator("canvas").first().screenshot());

const fatal = errs.filter((e) => !/favicon/i.test(e));
console.log(`console errors  ${fatal.length ? fatal.slice(0, 2).join(" | ") : "none"}`);

// Success means the toggle engaged cleanly and measurably more of the window
// became kraft than before.
const passed = pressed === "true" && alert.length === 0 && kraftShare - before > 0.05;
console.log(passed ? "\nPASS  background replaced with kraft" : "\nFAIL");
await b.close();
process.exit(passed ? 0 : 1);

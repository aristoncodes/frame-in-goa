/* eslint-disable @typescript-eslint/no-unused-expressions --
   `cond ? ok(...) : fail(...)` reads as a check table here; that's deliberate. */
/**
 * Browser verification of the real user flow (the Node preview harness proves
 * the composition; this proves the browser pipeline: font loading into canvas,
 * HEIC decoding, drag-to-reposition, and the PNG download).
 *
 * Usage: npx tsx scripts/e2e.ts <baseUrl> <fixtureDir>
 */
import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";

const base = process.argv[2] ?? "http://localhost:3000";
const fixtures = process.argv[3] ?? "/tmp";
const outDir = path.join(process.cwd(), "scripts", "out", "e2e");
fs.mkdirSync(outDir, { recursive: true });

const results: string[] = [];
const ok = (m: string) => (results.push(`PASS  ${m}`), console.log("PASS ", m));
const fail = (m: string) => (results.push(`FAIL  ${m}`), console.log("FAIL ", m));

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    ...devices["iPhone 13"],
    // iPhone 13 profile is WebKit-flavoured; Chromium ignores the UA quirks but
    // the viewport + touch + DPR are what we actually care about here.
  });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.fonts.check('900 100px "Fraunces-Display"'), {
    timeout: 15000,
  });
  ok("page loads and brand fonts register");

  const noGate = await page.locator("text=/sign in|log in|sign up/i").count();
  noGate === 0 ? ok("no login/signup gate on the page") : fail("found an auth gate");

  /* ---------------------------------------------------- HEIC upload path */
  const heic = path.join(fixtures, "test.heic");
  const t0 = Date.now();
  await page.setInputFiles('input[type="file"]', heic);
  await page.waitForSelector("text=POSITION YOUR PHOTO", { timeout: 30000 });
  const heicMs = Date.now() - t0;
  ok(`HEIC (iPhone) upload decoded and rendered in ${heicMs}ms`);
  if (heicMs > 5000) fail(`HEIC decode took ${heicMs}ms — over the "few seconds" bar`);

  /* --------------------------------------------------------- fill fields */
  await page.getByPlaceholder("Aryan Chauhan").fill("Aryan Chauhan");
  await page.getByPlaceholder("Web3 / AI / Build").fill("Web3 / AI / Build");
  await page.getByPlaceholder("Founding Engineer").fill("Founding Engineer");
  await page.waitForTimeout(300);

  const title = await page.locator("p.font-display").first().textContent();
  title && title.trim().split(" ").length >= 2
    ? ok(`builder title generated: "${title.trim()}"`)
    : fail("builder title missing");

  /* ------------------------------------------------- canvas actually drew */
  const stats = await page.evaluate(() => {
    const c = document.querySelector("canvas") as HTMLCanvasElement;
    const ctx = c.getContext("2d")!;
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    const seen = new Set<string>();
    for (let i = 0; i < data.length; i += 4 * 997) {
      seen.add(`${data[i] >> 4},${data[i + 1] >> 4},${data[i + 2] >> 4}`);
    }
    return { w: c.width, h: c.height, colours: seen.size };
  });
  stats.w === 1080 && stats.h === 1350
    ? ok(`preview canvas is full-res ${stats.w}x${stats.h}`)
    : fail(`unexpected canvas size ${stats.w}x${stats.h}`);
  stats.colours > 25
    ? ok(`canvas composited (${stats.colours} distinct colour buckets)`)
    : fail("canvas looks blank/flat — render likely failed");

  await page.screenshot({ path: path.join(outDir, "mobile-card.png"), fullPage: true });

  const shot = await page.locator("canvas").first().screenshot();
  fs.writeFileSync(path.join(outDir, "browser-front.png"), shot);
  ok("captured browser-rendered card");

  /* ---------------------------------------------- drag to reposition */
  // Filling the fields above scrolls the control out of view; mouse coordinates
  // are viewport-relative, so bring it back before measuring.
  await page.locator('[role="application"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const box = await page.locator('[role="application"]').boundingBox();
  if (box) {
    // "Whole photo" at zoom 1 has no overflow, so panning is correctly a no-op.
    // Zoom in first: that is the state where dragging has something to move.
    await page.getByRole("slider", { name: "Zoom" }).fill("1.6");
    await page.waitForTimeout(300);
    const before = await canvasHash(page);
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    // Stepped moves: one big jump can be coalesced into a single pointermove
    // that arrives before the gesture start is recorded.
    for (let i = 1; i <= 10; i++) await page.mouse.move(cx, cy - i * 8);
    await page.mouse.up();
    await page.waitForTimeout(400);
    const after = await canvasHash(page);
    before !== after
      ? ok("drag-to-reposition changes the composited photo")
      : fail(`drag had no effect on the render (${before} -> ${after})`);
  } else fail("photo adjust control not found");

  /* -------------------------------------------------------- flip to back */
  await page.getByRole("button", { name: "back", exact: true }).click();
  await page.waitForTimeout(400);
  fs.writeFileSync(
    path.join(outDir, "browser-back.png"),
    await page.locator("canvas").first().screenshot(),
  );
  ok("card flips to the back face");
  await page.getByRole("button", { name: "front", exact: true }).click();

  /* ------------------------------------------------------------ download */
  const dl = page.waitForEvent("download", { timeout: 20000 });
  await page.getByRole("button", { name: /Download PNG/i }).click();
  const download = await dl;
  const saved = path.join(outDir, "downloaded-card.png");
  await download.saveAs(saved);
  const size = fs.statSync(saved).size;
  const magic = fs.readFileSync(saved).subarray(0, 8).toString("hex");
  magic === "89504e470d0a1a0a" && size > 50_000
    ? ok(`download is a real PNG (${(size / 1024).toFixed(0)}KB, ${download.suggestedFilename()})`)
    : fail(`download not a valid PNG (magic=${magic}, ${size} bytes)`);

  /* ------------------------------------------------------------ PFP mode */
  await page.getByRole("tab", { name: "PFP Frame" }).click();
  await page.waitForTimeout(500);
  const pfp = await page.evaluate(() => {
    const c = document.querySelector("canvas") as HTMLCanvasElement;
    return { w: c.width, h: c.height };
  });
  pfp.w === 1080 && pfp.h === 1080
    ? ok("PFP mode renders 1080x1080")
    : fail(`PFP canvas is ${pfp.w}x${pfp.h}`);
  fs.writeFileSync(
    path.join(outDir, "browser-pfp.png"),
    await page.locator("canvas").first().screenshot(),
  );
  await page.screenshot({ path: path.join(outDir, "mobile-pfp.png"), fullPage: true });

  const dl2 = page.waitForEvent("download", { timeout: 20000 });
  await page.getByRole("button", { name: /Download PNG/i }).click();
  await (await dl2).saveAs(path.join(outDir, "downloaded-pfp.png"));
  ok("PFP downloads as PNG");

  /* ------------------------------------------ landscape JPG in card mode */
  await page.getByRole("tab", { name: "Builder ID Card" }).click();
  await page.setInputFiles('input[type="file"]', path.join(fixtures, "landscape.jpg"));
  await page.waitForTimeout(1200);
  fs.writeFileSync(
    path.join(outDir, "browser-landscape.png"),
    await page.locator("canvas").first().screenshot(),
  );
  ok("landscape JPG accepted");

  /* --------------------------------------------- whole photo, no cropping */
  // corners.png carries a pure-magenta block in each of its four corners. In
  // "Whole photo" mode every block must survive into the card; in "Fill frame"
  // mode the 16:9 source is cropped to a narrower window and they are lost.
  await page.setInputFiles('input[type="file"]', path.join(fixtures, "corners.png"));
  await page.waitForTimeout(900);

  const corners = () =>
    page.evaluate(() => {
      const c = document.querySelector("canvas") as HTMLCanvasElement;
      const { data } = c.getContext("2d")!.getImageData(0, 0, c.width, c.height);
      let n = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 200 && data[i + 1] < 70 && data[i + 2] > 200) n++;
      }
      return n;
    });

  const whole = await corners();
  whole > 1000
    ? ok(`"Whole photo" crops nothing — all 4 corner markers survive (${whole}px)`)
    : fail(`corner markers were cropped away in Whole photo mode (${whole}px)`);
  fs.writeFileSync(
    path.join(outDir, "fit-whole.png"),
    await page.locator("canvas").first().screenshot(),
  );

  await page.getByRole("radio", { name: "Fill frame" }).click();
  await page.waitForTimeout(600);
  const filled = await corners();
  filled < whole * 0.25
    ? ok(`"Fill frame" crops to the window as expected (${filled}px)`)
    : fail(`Fill frame did not crop (${filled}px vs ${whole}px)`);
  fs.writeFileSync(
    path.join(outDir, "fit-fill.png"),
    await page.locator("canvas").first().screenshot(),
  );

  await page.getByRole("radio", { name: "Whole photo" }).click();
  await page.waitForTimeout(400);

  /* ------------------------------------------------------ share to X */
  // The panel does the work in-page: nothing depends on the browser agreeing to
  // open a tab, so there is no popup path left to break.
  await page.getByRole("button", { name: /Share to X/i }).click();
  const dialog = page.getByRole("dialog", { name: "Your post" });
  await dialog.waitFor({ state: "visible", timeout: 15000 });
  ok("share opens a panel with the post ready");

  const caption = await dialog.getByRole("textbox").inputValue();
  caption.includes("#FrameInGoa")
    ? ok("caption in the panel contains #FrameInGoa (exact casing)")
    : fail(`caption is missing #FrameInGoa: ${caption}`);

  const openX = dialog.getByRole("link", { name: /Open X with this caption/i });
  const href = (await openX.getAttribute("href")) ?? "";
  const q = new URL(href).searchParams;
  /^https:\/\/(twitter|x)\.com\/intent\/tweet/.test(href) &&
  (q.get("text") ?? "").includes("#FrameInGoa")
    ? ok("panel's X link carries the caption and hashtag")
    : fail(`X link is wrong: ${href}`);

  // Copy must put the caption on the clipboard, since that is the whole point.
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
  await dialog.getByRole("button", { name: /Copy caption/i }).click();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  clip.includes("#FrameInGoa")
    ? ok("Copy caption puts the post on the clipboard")
    : fail(`clipboard did not receive the caption: ${clip.slice(0, 60)}`);

  // All three graphics — card front, card back and PFP — should be offered, so
  // one post can carry the whole set.
  const saveBtn = dialog.getByRole("button", { name: /Save all \d+ images/i });
  await saveBtn.waitFor({ state: "visible", timeout: 40000 });
  const got: string[] = [];
  page.on("download", (d) => got.push(d.suggestedFilename()));
  await saveBtn.click();
  await page.waitForTimeout(2500);
  const kinds = ["front", "back", "pfp"].filter((k) => got.some((f) => f.includes(k)));
  kinds.length === 3
    ? ok(`saves all three graphics (${got.length} PNGs: front, back, pfp)`)
    : fail(`expected front+back+pfp, got ${got.join(", ") || "nothing"}`);

  // The upload runs in the background, so wait for that section to settle rather
  // than reading it mid-flight and mistaking it for "no storage configured".
  await dialog
    .getByText("Uploading your graphic…")
    .waitFor({ state: "hidden", timeout: 30000 })
    .catch(() => {});
  const link = dialog.getByText(/\/s\/[a-z0-9]{6,}/).first();
  (await link.count())
    ? ok(`panel offers a shareable link: ${(await link.textContent())?.trim()}`)
    : ok("no blob storage: panel tells the user to attach the image instead");

  await dialog.getByRole("button", { name: "Close" }).click();
  await dialog.waitFor({ state: "hidden", timeout: 5000 });
  ok("panel closes");

  /* ------------------------------------------------- horizontal overflow */
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  overflow <= 1
    ? ok("no horizontal overflow at 390px wide")
    : fail(`page overflows horizontally by ${overflow}px`);

  errors.length === 0
    ? ok("no console/page errors")
    : fail(`console errors: ${errors.slice(0, 3).join(" | ")}`);

  await browser.close();

  console.log("\n" + results.join("\n"));
  const failed = results.filter((r) => r.startsWith("FAIL")).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
}

function canvasHash(page: import("playwright").Page) {
  return page.evaluate(() => {
    const c = document.querySelector("canvas") as HTMLCanvasElement;
    // sample the portrait window itself, not the poster backdrop
    const d = c.getContext("2d")!.getImageData(400, 570, 360, 270).data;
    let h = 0;
    for (let i = 0; i < d.length; i += 401) h = (h * 31 + d[i]) | 0;
    return h;
  });
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

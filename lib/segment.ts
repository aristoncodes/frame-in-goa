import { COLORS } from "./brand";
import { grain } from "./render/primitives";

/**
 * Optional background replacement.
 *
 * Cuts the person out of the uploaded photo with MediaPipe's selfie segmenter
 * and drops them onto the card's kraft paper, so every badge shares one backdrop
 * instead of showing whatever wall the photo was taken against.
 *
 * Everything runs on the device — no upload, no API key, and no cost. It is
 * opt-in and lazily loaded, because the runtime is a multi-megabyte WASM binary
 * and the core flow must stay instant without it.
 *
 * The 249KB model is served from `public/models`. The WASM runtime comes from
 * MediaPipe's CDN rather than the repo: self-hosting it would mean committing
 * ~12MB for a feature not everyone will turn on. If the CDN is unreachable the
 * cut-out simply fails and the original photo is kept.
 */

const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_PATH = "/models/selfie_segmenter.tflite";

/** Longest edge the segmenter runs at. The model works at 256px internally, so
 *  going above this buys nothing but costs time on a phone. */
const WORK_MAX = 1024;

/**
 * Which label in the category mask is the person.
 *
 * Model builds disagree on whether the subject is 0 or non-zero, and guessing
 * wrong inverts the cut-out — it replaces the person and keeps the wall. So
 * decide from the image instead: the border of a portrait is overwhelmingly
 * background, so whichever label dominates the frame's edge is the background.
 */
export function subjectLabelIsNonZero(mask: Uint8Array, w: number, h: number) {
  let nonZero = 0;
  let total = 0;
  const step = Math.max(1, Math.floor(Math.min(w, h) / 64));
  for (let x = 0; x < w; x += step) {
    for (const y of [0, h - 1]) {
      total++;
      if (mask[y * w + x] !== 0) nonZero++;
    }
  }
  for (let y = 0; y < h; y += step) {
    for (const x of [0, w - 1]) {
      total++;
      if (mask[y * w + x] !== 0) nonZero++;
    }
  }
  // Edge mostly non-zero ⇒ non-zero is the background ⇒ subject is zero.
  return total > 0 && nonZero / total < 0.5;
}

type Segmenter = {
  segment: (image: HTMLCanvasElement) => {
    categoryMask?: { getAsUint8Array(): Uint8Array } | null;
    close(): void;
  };
};

let segmenterPromise: Promise<Segmenter> | null = null;

export class BackgroundRemovalError extends Error {}

async function getSegmenter(): Promise<Segmenter> {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const { FilesetResolver, ImageSegmenter } = await import(
        "@mediapipe/tasks-vision"
      );
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
      return (await ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" },
        runningMode: "IMAGE",
        outputCategoryMask: true,
        outputConfidenceMasks: false,
      })) as unknown as Segmenter;
    })().catch((e) => {
      // Let the next attempt retry rather than caching the failure forever.
      segmenterPromise = null;
      throw new BackgroundRemovalError(
        e instanceof Error ? e.message : "segmenter failed to load",
      );
    });
  }
  return segmenterPromise;
}

function scaled(src: CanvasImageSource & { width: number; height: number }) {
  const longest = Math.max(src.width, src.height);
  const f = longest > WORK_MAX ? WORK_MAX / longest : 1;
  const c = document.createElement("canvas");
  c.width = Math.round(src.width * f);
  c.height = Math.round(src.height * f);
  const ctx = c.getContext("2d");
  if (!ctx) throw new BackgroundRemovalError("no 2d context");
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

/**
 * Replaces the photo's background with kraft paper. Returns a new canvas; the
 * caller keeps the original so the effect stays reversible.
 */
export async function replaceBackground(
  src: CanvasImageSource & { width: number; height: number },
): Promise<HTMLCanvasElement> {
  const segmenter = await getSegmenter();
  const work = scaled(src);
  const { width: w, height: h } = work;

  let mask: Uint8Array;
  const result = segmenter.segment(work);
  try {
    const category = result.categoryMask;
    if (!category) throw new BackgroundRemovalError("no mask returned");
    mask = category.getAsUint8Array();
  } finally {
    result.close();
  }

  const subjectIsNonZero = subjectLabelIsNonZero(mask, w, h);

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = w;
  maskCanvas.height = h;
  const mctx = maskCanvas.getContext("2d");
  if (!mctx) throw new BackgroundRemovalError("no 2d context");
  const img = mctx.createImageData(w, h);
  let subject = 0;
  for (let i = 0; i < mask.length; i++) {
    const on = subjectIsNonZero ? mask[i] !== 0 : mask[i] === 0;
    if (on) subject++;
    const o = i * 4;
    img.data[o] = 255;
    img.data[o + 1] = 255;
    img.data[o + 2] = 255;
    img.data[o + 3] = on ? 255 : 0;
  }
  // A mask covering almost nothing means the model found no person, and cutting
  // on it would erase the photo. A mask covering nearly everything is fine —
  // that's just a tightly framed headshot with little background to replace.
  if (subject / (w * h) < 0.04) {
    throw new BackgroundRemovalError("Couldn't find a person in that photo.");
  }
  mctx.putImageData(img, 0, 0);

  // Feather the edge so hair doesn't read as a cut-out sticker.
  const soft = document.createElement("canvas");
  soft.width = w;
  soft.height = h;
  const sctx = soft.getContext("2d");
  if (!sctx) throw new BackgroundRemovalError("no 2d context");
  sctx.filter = `blur(${Math.max(1, Math.round(Math.min(w, h) * 0.004))}px)`;
  sctx.drawImage(maskCanvas, 0, 0);
  sctx.filter = "none";

  // subject = photo ∩ mask
  const cut = document.createElement("canvas");
  cut.width = w;
  cut.height = h;
  const cctx = cut.getContext("2d");
  if (!cctx) throw new BackgroundRemovalError("no 2d context");
  cctx.drawImage(work, 0, 0);
  cctx.globalCompositeOperation = "destination-in";
  cctx.drawImage(soft, 0, 0);

  // kraft paper, then the subject on top
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const octx = out.getContext("2d");
  if (!octx) throw new BackgroundRemovalError("no 2d context");
  octx.fillStyle = COLORS.kraft;
  octx.fillRect(0, 0, w, h);
  // a wash of the card's own paper texture so it reads as printed, not pasted
  const wash = octx.createLinearGradient(0, 0, 0, h);
  wash.addColorStop(0, "rgba(255,255,255,0.16)");
  wash.addColorStop(1, "rgba(120,88,38,0.13)");
  octx.fillStyle = wash;
  octx.fillRect(0, 0, w, h);
  grain(
    octx as unknown as CanvasRenderingContext2D,
    0,
    0,
    w,
    h,
    0.0016,
    41,
    "rgba(255,255,255,0.3)",
    "rgba(90,64,26,0.16)",
  );

  // grounding shadow, so the subject sits on the paper
  octx.save();
  octx.filter = `blur(${Math.max(4, Math.round(Math.min(w, h) * 0.02))}px)`;
  octx.globalAlpha = 0.3;
  octx.drawImage(soft, 0, Math.round(h * 0.008));
  octx.restore();

  octx.drawImage(cut, 0, 0);
  return out;
}

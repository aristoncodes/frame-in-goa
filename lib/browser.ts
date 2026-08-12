import { FONTS } from "./brand";
import type { RenderEnv } from "./render/motifs";
import type { Ctx } from "./render/primitives";

/** RenderEnv backed by real DOM canvases. */
export const browserEnv: RenderEnv = {
  createCanvas(w, h) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    return { canvas, ctx: canvas.getContext("2d") as Ctx };
  },
};

let fontsReady: Promise<void> | null = null;

/**
 * Canvas draws with whatever is loaded at call time — it does not trigger font
 * loads or re-paint on swap. So every render path awaits this first, otherwise
 * the first card would silently composite in a fallback serif.
 */
export function ensureFonts(): Promise<void> {
  if (fontsReady) return fontsReady;
  fontsReady = (async () => {
    if (typeof document === "undefined" || !document.fonts) return;
    await Promise.all([
      document.fonts.load(`900 100px "${FONTS.display}"`, "HACKER HOUSE GOA 2026"),
      document.fonts.load(`400 100px "${FONTS.display}"`, "HACKER HOUSE GOA 2026"),
      document.fonts.load(`400 24px "${FONTS.body}"`),
      document.fonts.load(`700 24px "${FONTS.body}"`),
    ]);
    await document.fonts.ready;
  })();
  return fontsReady;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png"): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas export failed"))),
      type,
    );
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 20_000);
}

export function slugify(name: string, fallback = "builder") {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || fallback;
}

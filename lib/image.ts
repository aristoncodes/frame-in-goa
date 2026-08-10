/**
 * Upload pipeline: accept anything a phone will hand us (JPG, PNG, WebP and
 * HEIC/HEIF straight out of an iPhone camera roll), normalise it to a decoded
 * bitmap, and downscale it so compositing stays fast.
 */

const MAX_EDGE = 1800;

export class UnsupportedImageError extends Error {}

function isHeic(file: File) {
  const type = file.type.toLowerCase();
  if (type === "image/heic" || type === "image/heif") return true;
  // Safari and many Android pickers report an empty type for HEIC — fall back
  // to the extension, which is the only signal we get.
  return /\.(heic|heif)$/i.test(file.name);
}

/** Convert HEIC/HEIF to a JPEG blob. heic2any is heavy, so it is loaded lazily. */
async function convertHeic(file: File): Promise<Blob> {
  const { default: heic2any } = await import("heic2any");
  const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
  return Array.isArray(out) ? out[0] : (out as Blob);
}

async function decode(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      // imageOrientation honours EXIF rotation, which phone photos rely on.
      return await createImageBitmap(blob, { imageOrientation: "from-image" });
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new UnsupportedImageError("Could not decode image"));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

/**
 * Downscale to `MAX_EDGE` so a 48MP phone photo doesn't make every keystroke
 * re-composite a huge bitmap. Returns the source untouched if it's small enough.
 */
function downscale(src: CanvasImageSource & { width: number; height: number }) {
  const { width, height } = src;
  const longest = Math.max(width, height);
  if (longest <= MAX_EDGE) return src;
  const scale = MAX_EDGE / longest;
  const c = document.createElement("canvas");
  c.width = Math.round(width * scale);
  c.height = Math.round(height * scale);
  const ctx = c.getContext("2d");
  if (!ctx) return src;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

export type LoadedPhoto = {
  source: CanvasImageSource & { width: number; height: number };
  width: number;
  height: number;
};

export async function loadPhoto(file: File): Promise<LoadedPhoto> {
  if (file.size > 40 * 1024 * 1024) {
    throw new UnsupportedImageError("That image is over 40MB — try a smaller one.");
  }

  let blob: Blob = file;
  if (isHeic(file)) {
    try {
      blob = await convertHeic(file);
    } catch {
      // Some browsers (recent Safari) decode HEIC natively; if the converter
      // fails, try the original bytes before giving up.
      blob = file;
    }
  }

  let decoded: CanvasImageSource & { width: number; height: number };
  try {
    decoded = (await decode(blob)) as CanvasImageSource & { width: number; height: number };
  } catch {
    throw new UnsupportedImageError(
      "That file couldn't be read as an image. Try a JPG or PNG.",
    );
  }

  const source = downscale(decoded) as CanvasImageSource & { width: number; height: number };
  return { source, width: source.width, height: source.height };
}

export const ACCEPTED_TYPES =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

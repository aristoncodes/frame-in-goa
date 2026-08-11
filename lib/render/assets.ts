/**
 * Official HH Goa artwork, fetched from hhgoa.com and used in place of the
 * versions this project drew for itself. Every field is optional: each renderer
 * falls back to type when a mark hasn't loaded, so a slow network delays the
 * artwork rather than breaking the graphic.
 */
export type BrandAssets = {
  /** गोवा wordmark (assets/goa_hindi.svg). */
  goa: CanvasImageSource | null;
  /** 2:47 studio mark (assets/2-47.svg). */
  studio: CanvasImageSource | null;
  /** "Hacker House" wordmark (assets/Hacker house.png). */
  wordmark: CanvasImageSource | null;
  /** Optional full lockup for the card back (NEXT_PUBLIC_LOGO_URL). */
  logo: CanvasImageSource | null;
  /** Optional photograph of the lanyard clip (NEXT_PUBLIC_CLIP_URL). */
  clip: CanvasImageSource | null;
};

export const NO_ASSETS: BrandAssets = {
  goa: null,
  studio: null,
  wordmark: null,
  logo: null,
  clip: null,
};

/** Paths the marks are served from, shared by the app and the preview harness. */
export const BRAND_ASSET_PATHS = {
  goa: "/brand/goa-hindi.png",
  studio: "/brand/studio-247.png",
  wordmark: "/brand/hacker-house.png",
} as const;

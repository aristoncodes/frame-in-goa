/**
 * HH Goa 2026 brand tokens.
 * Every colour, face and spacing decision in the generators derives from here.
 */

export const COLORS = {
  green: "#0F5132",
  greenDeep: "#0B3F27",
  greenLight: "#1A6B44",
  gold: "#F4C430",
  goldDeep: "#C79A16",
  pink: "#E6197A",
  pinkDeep: "#B00F5C",
  kraft: "#D9C9A3",
  kraftDeep: "#C4B189",
  ink: "#3A2A1A",
  inkSoft: "#6B5636",
  cream: "#F5F1E6",
  silverHi: "#E8EBEE",
  silver: "#C9CDD3",
  silverLo: "#6E7278",
  black: "#141210",
} as const;

/**
 * The event site's own pairing: Imbue for display, Victor Mono for everything
 * else. Yatra One only backs up the गोवा wordmark if the official artwork
 * hasn't loaded.
 */
export const FONTS = {
  /** Tall high-contrast display serif — "HACKER HOUSE", "BUILDER ID", names. */
  display: "Imbue",
  /** Devanagari fallback for गोवा when the official mark is unavailable. */
  deva: "YatraOne",
  /** Utility mono — labels, meta, form text. */
  body: "VictorMono",
} as const;

export const EVENT = {
  name: "HACKER HOUSE GOA 2026",
  dates: "28-31 OCT 2026",
  location: "GOA, INDIA",
  url: "HHGOA.COM",
  studio: "2:47PM STUDIO",
  deva: "गोवा",
  hashtag: "#FrameInGoa",
} as const;

export const CANVAS = {
  card: { w: 1080, h: 1350 },
  pfp: { w: 1080, h: 1080 },
} as const;

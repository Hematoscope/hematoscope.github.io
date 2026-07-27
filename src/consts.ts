/** Responsive widths for optimized images */
export const WIDTHS = [240, 540, 720, 1200];

/**
 * Card accent colors, named after the tokens in `theme.css`. The order is the
 * cycle order used where accents are assigned automatically, e.g. news posts.
 */
export const ACCENTS = [
  "bytes-purple",
  "bytes-blue",
  "support-purple",
  "support-pink",
] as const;

export type Accent = (typeof ACCENTS)[number];

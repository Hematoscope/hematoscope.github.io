import type { ImageMetadata } from "astro";
import sharp from "sharp";

// Astro's imported ImageMetadata is a proxy that also exposes the absolute
// source path via `fsPath`. It is not part of the public type, so we widen it.
type WithFsPath = ImageMetadata & { fsPath?: string | undefined };

// A channel value at or above this counts as "white". Truly pure 255 is rare
// after jpeg compression, so allow a small tolerance.
const WHITE_THRESHOLD = 250;
// Alpha at or above this counts as opaque.
const ALPHA_OPAQUE = 250;
// Longest edge the image is scaled to before scanning. Keeps the raw buffer
// small while preserving edge colors well enough for a heuristic.
const SCAN_SIZE = 256;
// Thickness in pixels of the perimeter band that is inspected for white.
const EDGE_BAND = 2;
// Default share of edge pixels that must be white to warrant a frame.
const DEFAULT_WHITE_EDGE_CUTOFF = 0.4;

// Detection runs at build time and the same asset can be passed to several
// components, so memoize per (source file, cutoff).
const frameCache = new Map<string, boolean>();

/**
 * Returns true when an image needs a framing border to stay visible against a
 * light background, which is the case when it either contains transparent
 * pixels or has a mostly white perimeter.
 *
 * Runs at build time via sharp. `whiteEdgeCutoff` is the share of the perimeter
 * that must be white (0..1) to count as needing a frame. On any failure it
 * returns false, i.e. treat the image as safe and draw no frame.
 */
export async function imageNeedsFrame(
  image: ImageMetadata,
  whiteEdgeCutoff = DEFAULT_WHITE_EDGE_CUTOFF,
): Promise<boolean> {
  const fsPath = (image as WithFsPath).fsPath;
  if (!fsPath) return false;

  const cacheKey = `${fsPath}|${whiteEdgeCutoff}`;
  const cached = frameCache.get(cacheKey);
  if (cached !== undefined) return cached;

  let needsFrame = false;
  try {
    // Any transparency lets the page background show through the image.
    const { isOpaque } = await sharp(fsPath).stats();
    needsFrame = !isOpaque || (await hasWhiteEdges(fsPath, whiteEdgeCutoff));
  } catch {
    needsFrame = false;
  }

  frameCache.set(cacheKey, needsFrame);
  return needsFrame;
}

/** Fraction of the outer perimeter band that is opaque white >= cutoff. */
async function hasWhiteEdges(fsPath: string, cutoff: number): Promise<boolean> {
  const { data, info } = await sharp(fsPath)
    .resize({
      width: SCAN_SIZE,
      height: SCAN_SIZE,
      fit: "inside",
      withoutEnlargement: true,
      kernel: sharp.kernel.nearest,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const band = Math.max(
    1,
    Math.min(EDGE_BAND, Math.floor(Math.min(width, height) / 2)),
  );

  let edgePixels = 0;
  let whitePixels = 0;

  for (let y = 0; y < height; y += 1) {
    const onVerticalEdge = y < band || y >= height - band;
    for (let x = 0; x < width; x += 1) {
      const onEdge = onVerticalEdge || x < band || x >= width - band;
      if (!onEdge) continue;

      const i = (y * width + x) * channels;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const a = channels >= 4 ? (data[i + 3] ?? 0) : 255;

      edgePixels += 1;
      if (
        a >= ALPHA_OPAQUE &&
        r >= WHITE_THRESHOLD &&
        g >= WHITE_THRESHOLD &&
        b >= WHITE_THRESHOLD
      ) {
        whitePixels += 1;
      }
    }
  }

  return edgePixels > 0 && whitePixels / edgePixels >= cutoff;
}

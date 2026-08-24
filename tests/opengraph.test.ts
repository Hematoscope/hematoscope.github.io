import { readFile } from "node:fs/promises";
import { test, expect, type Page } from "@playwright/test";
import { newsSlugs, routedPaths } from "./routes";

// Every page must advertise a card that actually exists at the advertised size,
// since a crawler that cannot fetch or size the image falls back to no preview
// at all and the failure is invisible from the site itself.

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

// WhatsApp stops rendering a preview once the image runs past a few hundred KB,
// and every other crawler pays for the bytes. Cards sit well under this; the
// bound is here to catch a card going back to a format that does not compress.
const MAX_CARD_BYTES = 300_000;

/** Content of a `<meta>` tag, by property or name. */
function meta(page: Page, key: string) {
  return page
    .locator(`meta[property="${key}"], meta[name="${key}"]`)
    .first()
    .getAttribute("content");
}

test.describe("configuration", () => {
  test("the card palette still matches theme.css", async () => {
    // The cards are painted by satori, which cannot read a stylesheet, so the
    // token values are duplicated as literals in OG_COLORS. Keep them honest.
    const [theme, generator] = await Promise.all([
      readFile("src/styles/theme.css", "utf8"),
      readFile("src/utils/opengraphCard.ts", "utf8"),
    ]);

    const ogColors = generator.match(/const OG_COLORS = \{([^}]*)\}/s);
    expect(
      ogColors?.[1],
      "OG_COLORS not found in opengraphCard.ts",
    ).toBeTruthy();

    const entries = [
      ...ogColors![1]!.matchAll(/"([\w-]+)":\s*"(#[0-9a-f]{6})"/g),
    ].map(([, token, value]) => [token!, value!] as const);
    expect(entries.length).toBeGreaterThan(0);

    for (const [token, value] of entries) {
      const declared = theme.match(
        new RegExp(`--${token}:\\s*(#[0-9a-fA-F]{6})\\s*;`),
      );
      expect(
        declared?.[1],
        `--${token} not declared in theme.css`,
      ).toBeTruthy();
      expect(
        declared![1]!.toLowerCase(),
        `OG_COLORS["${token}"] has drifted from --${token}`,
      ).toBe(value);
    }
  });
});

test.describe("desktop", { tag: "@desktop" }, () => {
  // The tags are identical on every viewport, so check them once.
  test.skip(({ isMobile }) => isMobile);

  for (const path of routedPaths()) {
    test(`${path} shares a generated card`, async ({ page, request }) => {
      await page.goto(path);

      const [imageUrl, twitterImage, width, height, card, description] =
        await Promise.all([
          meta(page, "og:image"),
          meta(page, "twitter:image"),
          meta(page, "og:image:width"),
          meta(page, "og:image:height"),
          meta(page, "twitter:card"),
          meta(page, "og:description"),
        ]);

      expect(width).toBe(String(OG_WIDTH));
      expect(height).toBe(String(OG_HEIGHT));
      expect(card).toBe("summary_large_image");
      expect(description).not.toBe("");
      expect(twitterImage).toBe(imageUrl);

      // Absolute, as crawlers do not resolve relative image URLs.
      expect(imageUrl).toMatch(/^https?:\/\//);
      expect(new URL(imageUrl!).pathname).toMatch(/^\/og\/.+\.jpg$/);

      // The deployed origin in og:image is the canonical site, which is not
      // where the test server runs, so fetch the card from the site under test.
      const response = await request.get(new URL(imageUrl!).pathname);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("image/jpeg");

      const jpeg = await response.body();
      expect(jpeg.subarray(0, 2).toString("hex"), "not a JPEG").toBe("ffd8");
      expect(jpegSize(jpeg)).toEqual({ width: OG_WIDTH, height: OG_HEIGHT });
      expect(jpeg.byteLength).toBeLessThan(MAX_CARD_BYTES);
    });
  }

  test("a news post is shared as an article", async ({ page }) => {
    // Any post will do: being an article is a property of the post type, not
    // of one particular post, so take whichever one is on disk.
    const [slug] = newsSlugs();
    expect(slug, "no news posts to check").toBeTruthy();

    await page.goto(`/news/${slug}`);
    expect(await meta(page, "og:type")).toBe("article");
    expect(await meta(page, "og:image")).toContain(`/og/news/${slug}.jpg`);
  });
});

/**
 * Dimensions from a JPEG's frame header. Unlike PNG, they are not at a fixed
 * offset: the file is a chain of length-prefixed segments and the size lives in
 * whichever one carries the frame.
 */
function jpegSize(jpeg: Buffer): { width: number; height: number } {
  let at = 2; // Past the start-of-image marker.
  while (at + 9 < jpeg.length) {
    expect(jpeg[at], `expected a segment marker at byte ${at}`).toBe(0xff);
    const marker = jpeg[at + 1]!;
    // Start-of-frame, baseline through progressive, is the one that carries the
    // size; every other segment is skipped by its own length.
    if (marker >= 0xc0 && marker <= 0xc2) {
      return {
        height: jpeg.readUInt16BE(at + 5),
        width: jpeg.readUInt16BE(at + 7),
      };
    }
    at += 2 + jpeg.readUInt16BE(at + 2);
  }
  throw new Error("no frame header found in JPEG");
}

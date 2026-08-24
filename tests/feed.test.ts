import { test, expect } from "@playwright/test";
import { newsSlugs } from "~src/utils/routes";

// A feed is only useful if a reader can trust the links in it: it stores one
// as the post's identity, so a link that redirects, or that names a URL the
// site does not treat as canonical, quietly makes the same post look like two.

const SITE = "https://cellbytes.io";

test.describe("desktop", { tag: "@desktop" }, () => {
  // The feed does not vary by viewport, so check it once.
  test.skip(({ isMobile }) => isMobile);

  test("lists every published post", async ({ request }) => {
    const response = await request.get("/rss.xml");
    expect(response.status()).toBe(200);

    const xml = await response.text();
    const links = [...xml.matchAll(/<link>(.*?)<\/link>/g)]
      .map(([, link]) => link!)
      .filter((link) => link.includes("/news/"));

    // Drafts are routed so they can be previewed, not announced, so the feed
    // is the published set rather than everything under src/content/news.
    expect(links.sort()).toEqual(
      newsSlugs()
        .map((slug) => `${SITE}/news/${slug}`)
        .sort(),
    );
  });

  test("links posts at their canonical URL", async ({ request }) => {
    const xml = await (await request.get("/rss.xml")).text();

    for (const [, link] of xml.matchAll(/<link>(.*?)<\/link>/g)) {
      expect(link, "a feed link carries a trailing slash").not.toMatch(/.\/$/);
    }
  });

  test("is advertised from every page's head", async ({ page }) => {
    await page.goto("/company");
    await expect(
      page.locator('link[rel="alternate"][type="application/rss+xml"]'),
    ).toHaveAttribute("href", `${SITE}/rss.xml`);
  });
});

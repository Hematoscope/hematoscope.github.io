import { test, expect, type Page } from "@playwright/test";
import { newsSlugs, routedPaths } from "~src/utils/routes";

// Structured data is only worth having if it agrees with the page it sits on.
// A graph naming a different URL, or dating a post differently from its own
// head, is a claim nobody can check against the page, and nothing about the
// page looks wrong when it happens.

const SITE = "https://cellbytes.io";
const ORGANIZATION_ID = `${SITE}/#organization`;

async function graph(page: Page): Promise<Record<string, unknown>[]> {
  const json = await page
    .locator('script[type="application/ld+json"]')
    .textContent();
  expect(json, "no structured data on the page").toBeTruthy();

  const parsed = JSON.parse(json!) as {
    "@context": string;
    "@graph": Record<string, unknown>[];
  };
  expect(parsed["@context"]).toBe("https://schema.org");
  return parsed["@graph"];
}

function node(nodes: Record<string, unknown>[], type: string) {
  return nodes.find((entry) => entry["@type"] === type);
}

async function metaContent(page: Page, property: string) {
  return page
    .locator(`meta[property="${property}"]`)
    .first()
    .getAttribute("content");
}

test.describe("desktop", { tag: "@desktop" }, () => {
  // The graph is identical on every viewport, so check it once.
  test.skip(({ isMobile }) => isMobile);

  for (const path of routedPaths()) {
    test(`${path} identifies the same organization`, async ({ page }) => {
      await page.goto(path);
      const nodes = await graph(page);

      // One `@id` across the site is the whole point: it is what says the
      // company on this domain and the one on LinkedIn are one thing.
      const org = node(nodes, "Organization");
      expect(org?.["@id"]).toBe(ORGANIZATION_ID);
      expect(org?.["sameAs"]).toContain(
        "https://www.linkedin.com/company/cellbytes",
      );

      expect(node(nodes, "WebSite")?.["publisher"]).toEqual({
        "@id": ORGANIZATION_ID,
      });
    });
  }

  for (const slug of newsSlugs()) {
    test(`/news/${slug} describes itself as an article consistently`, async ({
      page,
    }) => {
      await page.goto(`/news/${slug}`);
      const posting = node(await graph(page), "BlogPosting");
      expect(posting, "post has no BlogPosting node").toBeTruthy();

      const canonical = await page
        .locator('link[rel="canonical"]')
        .getAttribute("href");
      expect(posting!["mainEntityOfPage"]).toBe(canonical);

      // The head and the graph take their dates from the same values. This is
      // what catches one of the two being wired to frontmatter alone.
      expect(posting!["datePublished"]).toBe(
        await metaContent(page, "article:published_time"),
      );
      expect(posting!["dateModified"]).toBe(
        await metaContent(page, "article:modified_time"),
      );

      // Published is authored, modified comes from git: a post that has been
      // touched since publication cannot have moved backwards.
      expect(
        new Date(posting!["dateModified"] as string).valueOf(),
        "modified predates published",
      ).toBeGreaterThanOrEqual(
        new Date(posting!["datePublished"] as string).valueOf(),
      );

      expect(posting!["publisher"]).toEqual({ "@id": ORGANIZATION_ID });
    });
  }

  test("a post's breadcrumb trail starts at the news listing", async ({
    page,
  }) => {
    const [slug] = newsSlugs();
    expect(slug, "no news posts to check").toBeTruthy();

    await page.goto(`/news/${slug}`);
    const trail = node(await graph(page), "BreadcrumbList");
    expect(trail?.["itemListElement"]).toMatchObject([
      { position: 1, item: `${SITE}/news` },
      { position: 2, item: `${SITE}/news/${slug}` },
    ]);
  });

  test("the application page describes the product", async ({ page }) => {
    await page.goto("/application");
    const app = node(await graph(page), "SoftwareApplication");

    expect(app?.["url"]).toBe(`${SITE}/application`);
    // The description is the page's own, so the two cannot drift apart.
    expect(app?.["description"]).toBe(
      await page.locator('meta[name="description"]').getAttribute("content"),
    );
  });

  test("a page that is not an article claims no article metadata", async ({
    page,
  }) => {
    await page.goto("/company");
    expect(await metaContent(page, "og:type")).toBe("website");
    await expect(page.locator('meta[property^="article:"]')).toHaveCount(0);
  });
});

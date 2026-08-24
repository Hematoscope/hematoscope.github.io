import { test, expect } from "@playwright/test";
import config from "../astro.config.mjs";
import { pageRoute, routedPaths } from "~src/utils/routes";

// The site serves one URL per page and says so: no `.html`, no trailing slash,
// and every internal link pointing at that exact shape. GitHub Pages resolves
// an unslashed path only because the build emits flat `<page>.html` files, and
// a link written with a slash gets a 301 rather than the page, so the shape has
// to hold on both sides at once. Neither half is visible from the page itself.

const SITE = "https://cellbytes.io";

test.describe("canonical URLs", () => {
  for (const path of routedPaths()) {
    test(`${path} declares itself canonical`, async ({ page }) => {
      await page.goto(path);

      const canonical = await page
        .locator('link[rel="canonical"]')
        .getAttribute("href");
      expect(canonical).toBe(`${SITE}${path === "/" ? "/" : path}`);

      // og:url and the canonical name the same page. They are set from one
      // value; this catches someone reintroducing `Astro.url` for either.
      const ogUrl = await page
        .locator('meta[property="og:url"]')
        .getAttribute("content");
      expect(ogUrl).toBe(canonical);
    });
  }
});

test.describe("internal links", () => {
  test("no internal link carries a trailing slash", async ({ page }) => {
    const offenders: string[] = [];

    for (const path of routedPaths()) {
      await page.goto(path);
      const hrefs = await page
        .locator("a[href]")
        .evaluateAll((links) =>
          links.map((link) => link.getAttribute("href") ?? ""),
        );

      for (const href of hrefs) {
        // Only same-site page links are ours to shape. The bare "/" is the
        // home page rather than a slashed path.
        if (!href.startsWith("/") || href === "/") continue;
        if (href.endsWith("/")) offenders.push(`${path} -> ${href}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  test("every internal link resolves without a redirect", async ({
    page,
    request,
  }) => {
    const seen = new Set<string>();

    for (const path of routedPaths()) {
      await page.goto(path);
      const hrefs = await page
        .locator("a[href]")
        .evaluateAll((links) =>
          links.map((link) => link.getAttribute("href") ?? ""),
        );

      for (const href of hrefs) {
        if (!href.startsWith("/") || href.startsWith("//")) continue;
        seen.add(href.split("#")[0]!);
      }
    }

    for (const href of seen) {
      if (href === "") continue;
      const response = await request.get(href, { maxRedirects: 0 });
      expect(
        response.status(),
        `${href} did not resolve directly`,
      ).toBeLessThan(300);
    }
  });
});

test.describe("retired URLs", () => {
  // Read from the config rather than listed here, so an entry cannot be added
  // without also being checked, and a typo in a target fails instead of
  // shipping a stub that points nowhere.
  const retired = Object.entries(config.redirects ?? {});

  test("there is something to check", () => {
    expect(retired.length).toBeGreaterThan(0);
  });

  for (const [from, to] of retired) {
    test(`${from} still reaches a page`, async ({ page }) => {
      const target = typeof to === "string" ? to : to.destination;

      // Waited for rather than read straight after the navigation: a stub
      // moves the reader with a meta refresh, which lands after `goto`
      // resolves, so reading the URL there races the redirect.
      await page.goto(from);
      await page.waitForURL(target);

      // A stub that lands on the 404 page is worse than the 404 it replaced,
      // since it looks handled from the config alone.
      expect(routedPaths()).toContain(target);
    });
  }
});

test("a page file that is not routed serves nothing", () => {
  // `_documentation.astro` is parked, not published. `pageRoute` is what the
  // sharing-card walk and the sitemap both trust to tell them so.
  expect(pageRoute("_documentation.astro")).toBeUndefined();
});

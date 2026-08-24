import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { routedPaths } from "~src/utils/routes";

// The sitemap is built from the dist output, not served by the dev server, so
// this reads the file a deploy would upload. It is the only place that tells a
// crawler when a page last changed, and a page missing from it is a page
// nothing is told to look at again.

const SITE = "https://cellbytes.io";
const SITEMAP = "dist/sitemap-0.xml";

async function sitemapEntries(): Promise<Map<string, string | undefined>> {
  const xml = await readFile(SITEMAP, "utf8").catch(() => {
    throw new Error(`${SITEMAP} is missing. Run \`npm run build\` first.`);
  });

  const entries = new Map<string, string | undefined>();
  for (const [, block] of xml.matchAll(/<url>(.*?)<\/url>/gs)) {
    const loc = block!.match(/<loc>(.*?)<\/loc>/)?.[1];
    if (!loc) continue;
    // The integration lists the origin bare, which is the same URL as "/".
    const path = new URL(loc).pathname;
    entries.set(
      path === "" ? "/" : path,
      block!.match(/<lastmod>(.*?)<\/lastmod>/)?.[1],
    );
  }
  return entries;
}

test.describe("sitemap", () => {
  test("lists every page the site serves, and nothing else", async () => {
    const entries = await sitemapEntries();
    expect([...entries.keys()].sort()).toEqual(routedPaths());
  });

  test("every entry carries a last-modified date from git", async () => {
    const entries = await sitemapEntries();

    for (const [path, lastmod] of entries) {
      expect(lastmod, `${path} has no lastmod`).toBeTruthy();
      expect(
        new Date(lastmod!).valueOf(),
        `${path} has an unparseable lastmod`,
      ).not.toBeNaN();
    }
  });

  test("is announced by robots.txt", async () => {
    const robots = await readFile("public/robots.txt", "utf8");
    expect(robots).toContain(`Sitemap: ${SITE}/sitemap-index.xml`);
  });
});

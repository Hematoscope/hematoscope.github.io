import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { pageRoute } from "~src/utils/opengraph";

/**
 * Every path the site routes, found by walking `src/pages` and
 * `src/content/news` rather than listed by hand. A hand-written list keeps
 * passing after someone adds a page and forgets whatever the suite was
 * checking; this one fails on the new page.
 */

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

/**
 * Slug of every news post. A post is a folder `<slug>/index.md`, and the
 * trailing `index` goes: the loader drops it too, so the folder never shows up
 * in a URL.
 */
export function newsSlugs(): string[] {
  return walk("src/content/news")
    .filter((file) => /\.mdx?$/.test(file))
    .map((file) =>
      relative("src/content/news", file)
        .replace(/\.mdx?$/, "")
        .replace(/\/index$/, ""),
    )
    .sort();
}

export function routedPaths(): string[] {
  const pages = walk("src/pages")
    .filter((file) => /\.(astro|mdx?)$/.test(file))
    .map((file) => pageRoute(relative("src/pages", file)))
    .filter((route) => route !== undefined);

  // Drafts are routed like any other post, so they count like any other.
  const posts = newsSlugs().map((slug) => `/news/${slug}`);

  return [...pages, ...posts].sort();
}

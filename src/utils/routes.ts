import { readdirSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * What the site serves, and which file each route comes from.
 *
 * Found by walking `src/pages` and `src/content/news` rather than listed
 * anywhere. A hand-written list keeps agreeing with itself after someone adds
 * a page and forgets to register it; this one grows with the page.
 *
 * Reads the filesystem, so it belongs to the build: the sitemap, the tests, and
 * anything else that has to enumerate the site. Nothing here ships to a browser.
 */

const PAGES_DIR = "src/pages";
const NEWS_DIR = "src/content/news";

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
  return walk(NEWS_DIR)
    .filter((file) => /\.mdx?$/.test(file))
    .map((file) =>
      relative(NEWS_DIR, file)
        .replace(/\.mdx?$/, "")
        .replace(/\/index$/, ""),
    )
    .sort();
}

/** Every path the site routes. Drafts included: they are routed like any other post. */
export function routedPaths(): string[] {
  return [...routeSources().keys()].sort();
}

/**
 * Route to the file it is built from, which is what lets anything asking about
 * a page reach its history or its frontmatter without being told where to look.
 */
export function routeSources(): Map<string, string> {
  const pages = walk(PAGES_DIR)
    .filter((file) => /\.(astro|mdx?)$/.test(file))
    .map((file) => [pageRoute(relative(PAGES_DIR, file)), file] as const)
    .filter(([route]) => route !== undefined);

  const posts = walk(NEWS_DIR)
    .filter((file) => /\.mdx?$/.test(file))
    .map(
      (file) =>
        [
          `/news/${relative(NEWS_DIR, file)
            .replace(/\.mdx?$/, "")
            .replace(/\/index$/, "")}`,
          file,
        ] as const,
    );

  return new Map([...pages, ...posts] as (readonly [string, string])[]);
}

/**
 * The route a page file under `src/pages` serves, or undefined when it serves
 * none: `_`-prefixed files are not routed and `[...]` ones are dynamic, so
 * their metadata is per-entry rather than per-file and comes from elsewhere.
 *
 * Shared by the card endpoint, which walks the pages to decide what to draw,
 * and by `routeSources` above, which is how everything else finds them.
 */
export function pageRoute(relPath: string): string | undefined {
  const rel = relPath.replace(/\.(astro|mdx?)$/, "");
  if (rel.split("/").some((part) => /^[_[]/.test(part))) return undefined;
  const withoutIndex = rel === "index" ? "" : rel.replace(/\/index$/, "");
  return `/${withoutIndex}`;
}

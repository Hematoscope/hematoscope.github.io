/**
 * The canonical shape of a URL on this site: no `.html`, no trailing slash.
 *
 * `build.format: "file"` is what buys that shape. GitHub Pages resolves
 * `/company` straight to `company.html`, where a directory build leaves it
 * nothing to match and it answers with a 301 to `/company/` instead, so every
 * internal click and every crawl of an internal link pays for a redirect.
 *
 * The cost is that `Astro.url.pathname` is the output file's path during a
 * build (`/company.html`, `/index.html`), not the URL a visitor sees. Anything
 * that names the page to the outside world - the canonical link, `og:url`, the
 * sharing card's address - has to go through here rather than use it directly.
 */
export function canonicalPath(pathname: string): string {
  const path = pathname
    .replace(/\.html$/, "")
    .replace(/\/index$/, "")
    .replace(/\/+$/, "");
  return path === "" ? "/" : path;
}

/** Absolute canonical URL of the page served at `pathname`. */
export function canonicalUrl(pathname: string, site: URL | undefined): URL {
  return new URL(canonicalPath(pathname), site);
}

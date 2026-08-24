// @ts-check
import { createHash } from "node:crypto";
import { optimize } from "svgo";
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { gitModifiedDate } from "./src/utils/gitDate.ts";
import { canonicalPath } from "./src/utils/url.ts";
import { routeSources } from "./src/utils/routes.ts";

// Astro inlines imported SVGs into the page DOM. Our asset SVGs all use
// generic single-letter element ids (a, b, c, ... for their gradients), and
// ids are document-global, so two inlined SVGs on the same page collide: a
// fill:url(#a) reference binds to the first #a in document order rather than
// the gradient in its own SVG. That silently repaints one SVG with another's
// gradients (e.g. breaking the light-top / shadow-bottom 3D shading on the
// cell clusters).
//
// Run SVGO's prefixIds on every imported SVG so each id (and each url(#...)
// reference) is namespaced, making collisions impossible. Only prefixIds is
// enabled so the artwork is otherwise left untouched.
//
// Astro's built-in svgoOptimizer() cannot be used here: it passes only the SVG
// contents (never the file path) to SVGO, so prefixIds falls back to a single
// static "prefix" for every file and the ids still collide. Instead we derive
// a per-file prefix from a hash of the contents: deterministic (stable build
// output) and unique per distinct SVG.
const prefixIdsOptimizer = {
  name: "svgo-prefix-ids",
  /** @param {string} contents */
  optimize: (contents) => {
    const hash = createHash("sha1").update(contents).digest("hex").slice(0, 8);
    return optimize(contents, {
      plugins: [{ name: "prefixIds", params: { prefix: `svg${hash}` } }],
    }).data;
  },
};

// A published URL is a promise, and GitHub Pages has no way to keep one: it
// serves static files, so there is no 301 to configure. Astro emits a stub page
// for each entry here instead, carrying a canonical link to the new address and
// a meta refresh for the reader. Renaming a post means adding a line here, not
// retiring the URL it was announced under.
const RETIRED_URLS_MAP = {
  "/news/cellbytes-and-evident-join-forces":
    "/news/cellbytes-and-evident-case-study",
};
const RETIRED_URLS = new Set(Object.keys(RETIRED_URLS_MAP));

// The canonical origin, not the GitHub Pages one: cellbytes.github.io serves
// the site but redirects to this. Only generated absolute URLs read it (see
// `Astro.site` in Layout.astro), so pointing it at the domain visitors and
// crawlers actually land on keeps og:url and og:image off a redirect hop.
const SITE = "https://cellbytes.io";

// https://astro.build/config
export default defineConfig({
  // `base` stays the default `/`: this is an org page served at the root, not a
  // project page under a repository path.
  site: SITE,
  // Flat `<page>.html` output rather than `<page>/index.html`, which is what
  // lets GitHub Pages answer `/company` with the page itself. A directory build
  // gives it nothing to match on the unslashed path, so it 301s to `/company/`
  // and every internal link costs a redirect. `trailingSlash` only makes the
  // dev server agree with that; the host decides in production.
  //
  // `Astro.url.pathname` is the output file's path under this format, so
  // anything naming a page externally goes through `src/utils/url.ts`.
  build: { format: "file" },
  trailingSlash: "never",
  redirects: RETIRED_URLS_MAP,
  // MDX so a post can import its own colocated assets and components (see
  // src/content.config.ts). Plain `.md` posts are untouched by this: the
  // integration only adds a second content format alongside them.
  integrations: [
    mdx(),
    // The sitemap is where `lastmod` lives, and freshness is what decides
    // whether anything re-reads a page it has already seen. The dates come from
    // git rather than from frontmatter, which only records publication: a post
    // edited a year later would otherwise still look untouched.
    sitemap({
      // The build lists redirect stubs alongside pages. A stub is `noindex` and
      // exists only to forward a retired URL, so advertising it would ask
      // crawlers to index the one page on the site that says not to.
      filter: (page) =>
        !RETIRED_URLS.has(canonicalPath(new URL(page).pathname)),
      serialize(item) {
        const path = canonicalPath(new URL(item.url).pathname);
        const source = routeSources().get(path);
        const lastmod = source && gitModifiedDate(source);
        return lastmod ? { ...item, lastmod: lastmod.toISOString() } : item;
      },
    }),
  ],
  experimental: {
    svgOptimizer: prefixIdsOptimizer,
  },
});

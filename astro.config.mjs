// @ts-check
import { createHash } from "node:crypto";
import { optimize } from "svgo";
import { defineConfig } from "astro/config";

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

// https://astro.build/config
export default defineConfig({
  site: "https://cellbytes.github.io",
  experimental: {
    svgOptimizer: prefixIdsOptimizer,
  },
});

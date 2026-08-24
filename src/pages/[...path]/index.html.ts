import type { APIRoute, GetStaticPaths } from "astro";
import { routedPaths } from "~src/utils/routes";

/**
 * A stub at `<page>/index.html` for every page, forwarding the slashed form of
 * its URL to the unslashed one.
 *
 * The site moved to flat `<page>.html` output so GitHub Pages could answer
 * `/company` directly instead of redirecting to `/company/`. The slashed form
 * is the one that was indexed while the site built to directories, though, and
 * GitHub Pages answers it with a 404 once the directory is gone. Every URL the
 * site ever published has to keep leading somewhere, so it leads here.
 *
 * `astro.config.mjs`'s `redirects` cannot express this: it normalizes a slashed
 * key to the unslashed route and emits the stub *as* that page, replacing the
 * real one. An endpoint names its own output file, so `index.html.ts` under a
 * rest parameter puts the stub exactly where the old directory used to be.
 *
 * Serving both shapes is not a conflict. GitHub Pages tries `<path>.html`
 * before it considers a directory of the same name, which is why `/news`
 * reaches the listing rather than the stub even though `news/` exists.
 */

export const getStaticPaths: GetStaticPaths = () =>
  routedPaths()
    // The front page has no slashed form to forward: `/` is already the
    // unslashed URL, and its stub would be the real `index.html`.
    .filter((path) => path !== "/")
    .map((path) => ({ params: { path: path.replace(/^\//, "") } }));

export const GET: APIRoute = ({ params, site }) => {
  const target = new URL(`/${params.path}`, site).href;

  // `noindex` so the stub never competes with the page it forwards to, and a
  // canonical link so anything that reads it anyway is told which URL counts.
  return new Response(
    `<!doctype html>
<meta charset="utf-8">
<title>Redirecting to ${target}</title>
<meta http-equiv="refresh" content="0; url=${target}">
<meta name="robots" content="noindex">
<link rel="canonical" href="${target}">
<body><a href="${target}">This page has moved to ${target}</a></body>
`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
};

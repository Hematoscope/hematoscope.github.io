# Agent guidelines

Development guide for coding agents working on the Cellbytes web home page.
For what this site is, read [README.md](README.md) first; this file only covers
how to develop on it.

## What this repo is, in one line

The public marketing/home page for the Cellbytes application, built with Astro
and deployed via GitHub Pages (`cellbytes.github.io`), which serves it under the
custom domain `cellbytes.io` and redirects the github.io URLs there. That domain
is configured in the repository's Pages settings, not by a `CNAME` file in the
tree, and `site` in `astro.config.mjs` names it so generated absolute URLs point
at the origin visitors actually reach.

## Toolchain

- Node; npm for dependencies (`package-lock.json`).
- Framework: Astro (`astro.config.mjs`), with the MDX integration for news
  posts; content/components under `src/`, static assets under `public/`.
- Lint: ESLint (`eslint.config.js`, with the Astro, jsx-a11y, and Playwright
  plugins). Format: Prettier (`.prettierrc.mjs`, `prettier-plugin-astro`).
- Tests: Playwright (`playwright.config.ts`, specs under `tests/`).
- Video playback uses `hls.js`.

## Common commands

| Command                  | Purpose                                              |
| ------------------------ | ---------------------------------------------------- |
| `npm install`            | Install dependencies.                                |
| `npm run dev`            | Start the Astro dev server (`--host`).               |
| `npm run build`          | `astro check` (type/diagnostics) then `astro build`. |
| `npm run preview`        | Serve the production build locally.                  |
| `npm test`               | Run the Playwright suite.                            |
| `npm run test:smoke`     | Run the home-page smoke test only.                   |
| `npx eslint .`           | Lint.                                                |
| `npx prettier --write .` | Format.                                              |

There is no `lint`/`format` npm script; invoke `eslint` and `prettier` directly
as above.

## Conventions

- Only use ASCII characters in code and comments. No em-dashes, en-dashes,
  unicode arrows, or other special characters.
- Keep components in Astro idiom; reach for client-side JS only where needed.

### News posts: a file or a folder

The `news` collection (`src/content.config.ts`) takes `.md` and `.mdx`, and a
post is either shape:

- `src/content/news/<slug>.md` for a post whose only asset is a hero image,
  which sits beside it in the same directory.
- `src/content/news/<slug>/index.mdx` for a post that carries several assets:
  `hero.png`, a recording, its poster. They live in the post's own folder, so
  they travel with it and cannot be orphaned by a rename.

Both serve `/news/<slug>`. The loader's `generateId` drops a trailing `/index`,
which is what keeps the folder shape off the URL, so moving a post from one
shape to the other never changes where it is published. Anything walking the
posts by filename has to strip it too; `tests/opengraph.test.ts` does.

`.mdx` buys one thing over `.md`: the post can `import` components and its own
colocated files, with Vite content-hashing whatever it imports. A screen
recording goes through `PostVideo`, which takes URLs rather than reading the
files itself:

```mdx
import PostVideo from "~src/components/PostVideo.astro";
import demo from "./demo.mp4?url";
import demoPoster from "./demo-poster.jpg?url";

<PostVideo
  src={demo}
  poster={demoPoster}
  width={1280}
  height={800}
  caption="What the recording shows, in a sentence."
/>
```

The declared `width`/`height` are the recording's real pixel size: they set the
aspect ratio, so the box is reserved before the poster loads. Recordings are
silent and carry no `<track>`; the caption and the prose around it are the text
alternative. See the component for why it does not autoplay.

Encode a recording the way the placeholder in
`src/content/news/new-standard-for-cell-reclassification/` is encoded: H.264,
`yuv420p`, no audio track, `-movflags +faststart`.

### Head metadata and OpenGraph cards

A page declares its own head metadata, in its own file, as an exported `meta`
that it spreads into the layout:

```astro
---
import Layout from "~src/layouts/Layout.astro";
import type { PageMeta } from "~src/utils/opengraph";
import hero from "~src/assets/images/example.jpg";

export const meta = {
  title: "Example | Cellbytes",
  description: "Shown in search results and on the sharing card.",
  card: { title: "A headline for the card", image: hero },
} satisfies PageMeta;
---

<Layout {...meta} />
```

`src/pages/og/[...slug].jpg.ts` renders one 1200x630 sharing card per page and
per news post. It finds the pages by globbing `src/pages` for that `meta` export
(or, for markdown pages, their frontmatter), so a new page gets a card with no
registration step and the card can never disagree with the head.

Nobody names a card's URL. `Layout` derives it from the page's own path with
`ogSlug` and the endpoint derives it from the page file's path, which is how the
two meet: `/application` gets `/og/application.jpg`, `/` gets `/og/index.jpg`.
`card` is optional throughout, so a page needs it only to override the headline
or supply a photo; without one the card falls back to the brand artwork.

Every routable page gets a card whether or not the walk can read metadata off
it, because `Layout` advertises one for every page unconditionally and a
crawler that 404s on the promised image drops the preview rather than falling
back. A page the walk cannot read declares no headline, so it gets the brand
card, the same one the front page uses. For the same reason the endpoint walks
news posts unfiltered: `news/[slug].astro` routes drafts too, so drafts need
cards too. They just have no accent, since accents are assigned to published
posts, which are the ones that sit next to each other in a listing.

That guarantee is the thing to preserve when adding a route. `pageRoute` in
`src/utils/opengraph.ts` decides what counts as routable and is shared with
`tests/opengraph.test.ts`, which walks `src/pages` and `src/content/news` and
fails if any page it finds does not serve a card. A new _dynamic_ route is the
one case the walk cannot see: enumerate its entries in the endpoint the way
news posts are, or its pages will promise cards that do not exist.

Things worth knowing before editing `src/utils/opengraphCard.ts`:

- The cards are built at build time by satori (layout, text to outlines), resvg
  (rasterize) and sharp (crop the photo, encode the JPEG). Nothing runs in a
  browser, so this works on GitHub Pages without a runtime image service.
- Cards are JPEG, not PNG. Most of them are photographs, which PNG stores
  essentially whole: the set was 5.2 MB as PNG against 0.8 MB as JPEG, and the
  biggest card alone was over 1 MB. That is not only bytes, it is previews, as
  WhatsApp stops rendering one past a few hundred KB. The test bounds every
  card at 300 KB so a format change cannot quietly undo this. Encoding keeps
  full chroma resolution (`4:4:4`), since a card is mostly type and flat brand
  color and the usual subsampling smears exactly those edges.
- satori has no stylesheet, so the brand colors are duplicated as literals in
  `OG_COLORS`. Name each entry after the `theme.css` token that holds the hex;
  `tests/opengraph.test.ts` compares the two and fails on drift.
- satori cannot read `public/lato.woff2`: it takes ttf/otf/woff only, and that
  file is a 194-codepoint subset with no smart quotes or dashes, which post
  titles do use. The generator therefore uses the full static Lato in
  `src/assets/fonts/` (OFL, license alongside).
- There are two card layouts. The headline one is the default: photo behind a
  bottom-up scrim mirroring the post hero, or, with no photo, a light brand wash
  with the bytes and cells clusters down the right, clear of the text on the
  left. `card: { variant: "brand" }` picks the other, the logotype alone between
  the clusters on opposite corners, which the front page uses.
- For the cells, reach for `corner-detached` over `cluster-large`: the large
  cluster packs 70 blobs into its box, which shrinks to fizz beside the bytes
  rather than reading as their counterpart.
- Text on a cluster card is clamped to a narrower measure so it stays clear of
  the artwork. A photo card has a full-bleed scrim instead, so it runs the full
  width; clamping it too truncated the post descriptions.
- The logotype is drawn exactly as exported, colors included. Over a photo it
  gets a white chip to sit on, the way the site puts it on the white navbar,
  bordered like a framed hero image so the pill still reads against a white
  photo. Do not recolor the mark: its ring and its wordmark share one
  `fill="black"`, so repainting for contrast changes the mark itself.
- The accent tokens are pastels meant for the white page and disappear on a
  light card, so the rule above the headline switches to `--accent-1` there.
- Titles and descriptions are clamped (3 and 2 lines) and the title steps down
  in size as it gets longer, so overlong copy degrades instead of overflowing.

### Colors in SVG artwork

The asset files under `src/assets/` keep whatever literal colors their design
tool exported; nothing rewrites them. Instead each usage site tags the SVG with
an `art-*` class and `src/styles/artwork.css` repaints it from `theme.css`
tokens, so overriding a token retints the artwork with it.

Adding or moving artwork:

- Tag it: `<BytesCluster class="art-bytes-cluster ..." />`. Untagged assets keep
  their exported colors and silently ignore the theme, which
  `tests/artwork-colors.test.ts` fails on.
- Add its color map to `artwork.css` and the matching entry to the `ARTWORK`
  table in that test.

Things worth knowing before editing either file:

- Astro inlines imported SVGs into the page DOM. That is what lets a stylesheet
  reach inside them and custom properties inherit into them. `var()` is not
  substituted in an SVG presentation attribute, so `fill="var(--x)"` inside an
  asset would do nothing; a stylesheet declaration always works.
- Illustrator keys its colors on generic `.cls-1`, `.cls-2`, ... classes, which
  our SVGO pass in `astro.config.mjs` namespaces with a per-file content hash.
  The hash changes with the artwork, so selectors match on the suffix:
  `[class$="__cls-1"]`.
- `cls-N` is positional, not semantic: `cls-1` is magenta in one asset and pale
  blue in another, and a re-export can renumber it. The maps are therefore per
  asset, and `tests/artwork-colors.test.ts` asserts the rendered color of every
  tagged element so a re-export fails loudly instead of mistinting a page.
- To retint one instance, override the token on an ancestor
  (`--bytes-magenta: var(--bytes-light-magenta)`) rather than overwriting the
  asset's fills; see `.bytes-corner` in `src/pages/application.astro`.

Not covered: the cell artwork in `src/assets/backgrounds/cells/`, whose colors
are radial gradient stops rather than flat fills. Brand marks stay hardcoded on
purpose, since the partner logos are third-party trademarks and the logotype has
to match `public/favicon.svg`, which is loaded through `<link rel="icon">` and
cannot see the page's custom properties at all.

## Before finishing a change

Ensure the site builds clean, lints, and the smoke test passes:

```sh
npx prettier --check . && npx eslint . && npm run build && npm run test:smoke
```

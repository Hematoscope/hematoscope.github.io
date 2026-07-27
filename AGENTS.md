# Agent guidelines

Development guide for coding agents working on the Cellbytes web home page.
For what this site is, read [README.md](README.md) first; this file only covers
how to develop on it.

## What this repo is, in one line

The public marketing/home page for the Cellbytes application, built with Astro
and deployed via GitHub Pages (`cellbytes.github.io`).

## Toolchain

- Node; npm for dependencies (`package-lock.json`).
- Framework: Astro 5 (`astro.config.mjs`); content/components under `src/`,
  static assets under `public/`.
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

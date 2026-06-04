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

| Command | Purpose |
| --- | --- |
| `npm install` | Install dependencies. |
| `npm run dev` | Start the Astro dev server (`--host`). |
| `npm run build` | `astro check` (type/diagnostics) then `astro build`. |
| `npm run preview` | Serve the production build locally. |
| `npm test` | Run the Playwright suite. |
| `npm run test:smoke` | Run the home-page smoke test only. |
| `npx eslint .` | Lint. |
| `npx prettier --write .` | Format. |

There is no `lint`/`format` npm script; invoke `eslint` and `prettier` directly
as above.

## Conventions

- Only use ASCII characters in code and comments. No em-dashes, en-dashes,
  unicode arrows, or other special characters.
- Keep components in Astro idiom; reach for client-side JS only where needed.

## Before finishing a change

Ensure the site builds clean, lints, and the smoke test passes:

```sh
npx prettier --check . && npx eslint . && npm run build && npm run test:smoke
```

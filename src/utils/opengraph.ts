import type { ImageMetadata } from "astro";
import type { Accent } from "~src/consts";
import { canonicalPath } from "~src/utils/url";

/**
 * The head metadata a page declares about itself, and how that turns into the
 * URL of its social sharing card.
 *
 * Kept free of the rendering dependencies so pages and `Layout.astro` can
 * import it; the card itself is drawn by `src/utils/opengraphCard.ts`, which
 * pulls in satori and sharp and is only reached from the `/og` endpoint.
 */

/**
 * Size of the generated cards. 1200x630 is the 1.91:1 ratio that Facebook,
 * LinkedIn, Slack and X all render a large summary card at.
 */
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

/**
 * Cards are JPEG. They are photographs as often as not, which PNG stores
 * whole: the same card is several hundred KB as PNG against well under a
 * hundred as JPEG, and WhatsApp drops a preview whose image runs past a few
 * hundred KB, so the heavier format costs previews rather than just bytes.
 */
export const OG_IMAGE_TYPE = "image/jpeg";

/** How a page wants its card to differ from its plain head metadata. */
export interface CardOptions {
  /**
   * `"brand"` draws the logotype alone, centered between the clusters, with no
   * headline at all, and ignores any photo. For the front page, where the site
   * name is the whole message.
   */
  variant?: "brand" | undefined;
  /** Headline, when the document title reads poorly on a card. */
  title?: string | undefined;
  /** Photo, drawn full bleed. Without one the card uses the brand artwork. */
  image?: ImageMetadata | undefined;
  /** Small uppercase line above the headline, e.g. a publication date. */
  eyebrow?: string | undefined;
  /** Color of the rule above the headline. */
  accent?: Accent | undefined;
}

/**
 * What a page exports as `meta` and spreads into `Layout`. Declaring it in the
 * page keeps the copy next to the markup it belongs to, and exporting it lets
 * `src/pages/og/[...slug].png.ts` find it without a second copy elsewhere.
 */
export interface PageMeta {
  /** Document title, used verbatim. */
  title: string;
  /** Meta description, and the card's supporting line. */
  description: string;
  card?: CardOptions;
  /** OpenGraph type. News posts are articles, everything else a website. */
  ogType?: "website" | "article";
}

const TITLE_SUFFIX = " | Cellbytes";

/**
 * Headline to draw on the card. The logotype is already on it, so the site name
 * a document title carries for the browser tab is dropped unless the page asked
 * for a different headline outright.
 */
export function cardHeading(meta: PageMeta): string {
  if (meta.card?.title) return meta.card.title;
  return meta.title.endsWith(TITLE_SUFFIX)
    ? meta.title.slice(0, -TITLE_SUFFIX.length)
    : meta.title;
}

/**
 * Card identifier for a page, derived from where the page lives. Both the page
 * (through `Layout`, from its own URL) and the endpoint that renders the cards
 * derive it the same way, so neither has to be told about the other.
 *
 * `Layout` hands it an output path, so the `.html` a flat build puts there is
 * dropped first; otherwise `/company.html` would ask for a card at
 * `/og/company.html.jpg` and every page would promise one that 404s.
 */
export function ogSlug(pathname: string): string {
  const trimmed = canonicalPath(pathname).replace(/^\/+/, "");
  return trimmed === "" ? "index" : trimmed;
}

/** URL of the card for `slug`, as served out of the static output. */
export function ogImagePath(slug: string): string {
  return `/og/${slug}.jpg`;
}

/**
 * The route a page file under `src/pages` serves, or undefined when it serves
 * none: `_`-prefixed files are not routed and `[...]` ones are dynamic, so
 * their metadata is per-entry rather than per-file and comes from elsewhere.
 *
 * Shared by the card endpoint, which walks the pages to decide what to draw,
 * and by `tests/opengraph.test.ts`, which walks them to check that every page
 * ended up with a card.
 */
export function pageRoute(relPath: string): string | undefined {
  const rel = relPath.replace(/\.(astro|mdx?)$/, "");
  if (rel.split("/").some((part) => /^[_[]/.test(part))) return undefined;
  const withoutIndex = rel === "index" ? "" : rel.replace(/\/index$/, "");
  return `/${withoutIndex}`;
}

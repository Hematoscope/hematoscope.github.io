import type { APIRoute, GetStaticPaths } from "astro";
import { getCollection } from "astro:content";
import { getNewsPosts } from "~src/utils/news";
import {
  cardHeading,
  ogSlug,
  pageRoute,
  OG_IMAGE_TYPE,
  type CardOptions,
  type PageMeta,
} from "~src/utils/opengraph";
import { renderOgCard, type OgCard } from "~src/utils/opengraphCard";

/**
 * One 1200x630 sharing card per page and per news post, written into the static
 * output as `/og/<page>.jpg` and `/og/news/<slug>.jpg`.
 *
 * The pages are found rather than listed: every routable page either exports a
 * `meta` (an `.astro` page) or carries frontmatter (a markdown page), which is
 * the same declaration it hands to `Layout`, so the copy on a card can never
 * drift from the copy in the page's own head. `Layout` derives the card's URL
 * from the page's path and `ogSlug` derives it here from the file's path, which
 * is what lets the two sides meet without either importing the other.
 *
 * Every routable page gets an entry, declared metadata or not. `Layout`
 * advertises a card for each of them unconditionally, and a page that promised
 * one and then 404s shares worse than one that never promised: crawlers do not
 * fall back, they just drop the preview. So a page the walk below cannot read
 * metadata off still gets `FALLBACK_CARD` rather than nothing.
 */

interface PageModule {
  meta?: PageMeta;
  frontmatter?: { title?: string; description?: string };
}

const pageModules = import.meta.glob<PageModule>("../**/*.{astro,md}", {
  eager: true,
});

/** The head metadata a page module declares, whichever way it declares it. */
function metaOf(module: PageModule): PageMeta | undefined {
  if (module.meta) return module.meta;

  // Markdown pages hand their frontmatter to Article.astro, which is what adds
  // the title suffix, so the title here is already the bare headline.
  const { title, description } = module.frontmatter ?? {};
  if (!title || !description) return undefined;
  return { title, description };
}

/**
 * What a page with no readable metadata shares: the brand card, the same one
 * the front page uses. With no headline to draw it is the honest option, and it
 * is a deliberate design rather than a placeholder, so a page that never
 * declares `meta` still shares as the site rather than as a broken image.
 */
const FALLBACK_CARD: OgCard = { variant: "brand", title: "Cellbytes" };

function cardFor(meta: PageMeta, overrides?: CardOptions): OgCard {
  return {
    variant: overrides?.variant,
    title: cardHeading(meta),
    description: meta.description,
    eyebrow: overrides?.eyebrow,
    image: overrides?.image,
    accent: overrides?.accent,
  };
}

export const getStaticPaths: GetStaticPaths = async () => {
  const pageCards = Object.entries(pageModules).flatMap(([key, module]) => {
    const route = pageRoute(key.replace(/^\.\.\//, ""));
    if (!route) return [];
    const meta = metaOf(module);
    return [
      {
        params: { slug: ogSlug(route) },
        props: { card: meta ? cardFor(meta, meta.card) : FALLBACK_CARD },
      },
    ];
  });

  // Accents belong to published posts, which are the ones that appear in a
  // listing next to each other and so have to differ. Posts are walked
  // unfiltered all the same, because `news/[slug].astro` routes drafts too and
  // every routed page needs a card; a draft simply has no accent to draw with.
  const accents = new Map(
    (await getNewsPosts()).map(({ post, accent }) => [post.id, accent]),
  );

  const postCards = (await getCollection("news")).map((post) => ({
    params: { slug: `news/${post.id}` },
    props: {
      card: cardFor(
        { title: post.data.title, description: post.data.description },
        {
          image: post.data.image,
          eyebrow: formatDate(post.data.date),
          accent: accents.get(post.id),
        },
      ),
    },
  }));

  return [...pageCards, ...postCards];
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export const GET: APIRoute = async ({ props }) => {
  const jpeg = await renderOgCard(props.card as OgCard);

  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": OG_IMAGE_TYPE,
      "Content-Length": String(jpeg.byteLength),
    },
  });
};

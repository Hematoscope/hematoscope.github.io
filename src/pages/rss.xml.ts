import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import { getNewsPosts } from "~src/utils/news";

/**
 * The news posts as a feed.
 *
 * The listing page is the only way to find out that something was published,
 * which means finding out requires visiting. A feed is how everything that
 * watches for new writing without being asked - readers, aggregators, the
 * ingestion side of anything that summarizes - learns about a post without
 * waiting to be recrawled.
 *
 * Drafts are excluded, since `getNewsPosts` filters them: a draft is routed so
 * it can be previewed, not announced.
 */
export const GET: APIRoute = async (context) => {
  const posts = await getNewsPosts();

  return rss({
    title: "Cellbytes",
    description:
      "Updates from the Cellbytes team on the Cellbytes application, digital pathology and related research.",
    // Set from the request rather than hardcoded, which keeps the feed's links
    // pointing at whatever origin served it.
    site: context.site ?? new URL(context.url).origin,
    // The package appends a slash to every item link by default, which is the
    // one URL shape the site does not serve as canonical. A feed reader stores
    // that link as the post's identity, so it has to be the same address the
    // post's canonical names.
    trailingSlash: false,
    items: posts.map(({ post }) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: `/news/${post.id}`,
    })),
    customData: "<language>en</language>",
  });
};

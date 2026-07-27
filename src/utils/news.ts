import { getCollection, type CollectionEntry } from "astro:content";
import { ACCENTS, type Accent } from "~src/consts";

export interface NewsPost {
  post: CollectionEntry<"news">;
  accent: Accent;
}

/**
 * Published news posts, newest first, each paired with its accent color.
 *
 * Accents cycle from the OLDEST post onwards, so a post keeps the same color
 * for good: publishing a new one takes the next accent in the cycle instead of
 * shifting the color of every post already published. Listings render newest
 * first, which makes the accents run backwards through the cycle.
 */
export async function getNewsPosts(): Promise<NewsPost[]> {
  const oldestFirst = (
    await getCollection("news", ({ data }) => !data.draft)
  ).sort((a, b) => a.data.date.valueOf() - b.data.date.valueOf());

  return oldestFirst
    .map((post, i) => ({ post, accent: ACCENTS[i % ACCENTS.length]! }))
    .reverse();
}

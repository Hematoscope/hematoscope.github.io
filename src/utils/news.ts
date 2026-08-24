import { getCollection, type CollectionEntry } from "astro:content";
import { ACCENTS, type Accent } from "~src/consts";
import { gitModifiedDate } from "~src/utils/gitDate";

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

/**
 * When a post last changed, from the history of the file it is written in.
 *
 * Frontmatter carries the date a post was published and nothing else, so a
 * post edited later would otherwise still present itself as untouched. Asking
 * git means there is no second date for an author to remember to bump.
 *
 * Undefined when the history cannot answer, which in practice means a checkout
 * too shallow to hold the commit. The page then says only when it was
 * published, which is worse than the truth but better than a date that is
 * quietly wrong.
 */
export function postModifiedDate(
  post: CollectionEntry<"news">,
): Date | undefined {
  return post.filePath ? gitModifiedDate(post.filePath) : undefined;
}

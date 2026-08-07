import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";

/**
 * Id of a post from its path, so a post can be a file or a folder.
 *
 * A post with nothing but a hero is one flat `<slug>.md`. A post that carries
 * several assets is a folder, `<slug>/index.mdx`, with its video, poster and
 * images beside it, which keeps them travelling with the post instead of
 * scattering into a shared directory.
 *
 * The two must serve the same URLs, so the trailing `/index` is dropped: the id
 * is the slug either way, and `/news/<slug>/` stays `/news/<slug>/` rather than
 * becoming `/news/<slug>/index/`.
 *
 * Unlike the default `generateId`, this does not slugify: the path is used as
 * the URL verbatim, so a post file or folder must already be named in URL-safe
 * kebab-case, as every existing one is.
 */
function newsId({ entry }: { entry: string }): string {
  return entry.replace(/\.(md|mdx)$/, "").replace(/\/index$/, "");
}

const news = defineCollection({
  loader: glob({
    pattern: "**/*.{md,mdx}",
    base: "./src/content/news",
    generateId: newsId,
  }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string(),
        description: z.string(),
        date: z.coerce.date(),
        author: z.string().optional(),
        tags: z.array(z.string()).optional(),
        draft: z.boolean().optional().default(false),
        image: image().optional(),
        imageAlt: z.string().optional(),
      })
      .refine((data) => !data.image || data.imageAlt, {
        message: "imageAlt is required when image is set",
      }),
});

export const collections = { news };

import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";

const news = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/news" }),
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

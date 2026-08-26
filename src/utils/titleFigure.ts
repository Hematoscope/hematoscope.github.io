import { defineHastPlugin } from "satteri";

/**
 * An image alone in a paragraph becomes a `<figure>`, captioned by whatever
 * follows it on the next line, or by its title when nothing does:
 *
 * ```md
 * ![What the image shows](./photo.jpg)
 * Adapted from figure 1 of Luukkainen[^1].
 *
 * ![What the image shows](./photo.jpg "A caption with no markup in it.")
 * ```
 *
 * The first form is a caption the parser has already read as markdown, so a
 * footnote reference in it is a real reference: numbered with the rest of them
 * and linked back to from the definition. The second cannot be, because a
 * title is plain text by definition, so a `[^1]` written there stays four
 * characters.
 *
 * A title is a hover tooltip and nothing else, so a caption written there is
 * invisible to anyone not holding a mouse over the image. Either form makes it
 * part of the post and ties it to the image it describes. Neither is a
 * substitute for `alt`, which still says what the image shows.
 *
 * Only a paragraph that starts with the image is converted, and only when a
 * line break separates the image from its caption. Prose wrapped around an
 * image is a sentence with a picture in it rather than a captioned figure, and
 * a `<figure>` cannot sit inside a `<p>` anyway.
 *
 * This is a Satteri plugin rather than the `rehype-title-figure` package
 * because Astro's default Markdown processor does not run rehype plugins; the
 * package would mean swapping the whole pipeline for the unified one. Astro
 * runs it for both `.md` and `.mdx`, ahead of its own image handling, so the
 * image in the figure is still optimized.
 */
export const titleFigure = defineHastPlugin({
  name: "title-figure",
  element: {
    filter: ["p"],
    visit(node) {
      const [image, ...rest] = node.children ?? [];
      if (image?.type !== "element" || image.tagName !== "img") return;

      const [breakNode, ...afterBreak] = rest;
      // A soft break is the newline that opens the text after the image, so
      // the caption starts once it is dropped; a hard break is a `<br>` of its
      // own. Anything else means the image and the words share a line, which
      // makes them prose rather than a figure.
      const caption =
        breakNode?.type === "text" && breakNode.value.startsWith("\n")
          ? [
              { type: "text" as const, value: breakNode.value.slice(1) },
              ...afterBreak,
            ]
          : breakNode?.type === "element" && breakNode.tagName === "br"
            ? afterBreak
            : rest.length === 0
              ? []
              : undefined;
      if (!caption) return;

      // The title only has a job when nothing else captions the image, and it
      // has none afterwards either: a tooltip repeating the line printed under
      // the image is noise, so it does not travel into the figure.
      const { title, ...properties } = image.properties ?? {};
      if (caption.length === 0) {
        if (typeof title !== "string" || !title) return;
        caption.push({ type: "text", value: title });
      }

      // A plain object rather than the visited node: Satteri materializes the
      // tree lazily, and only a fully built node can be handed back to it.
      // Astro's image handling reads `src` off the new one afterwards, so the
      // image is still optimized.
      return {
        type: "element",
        tagName: "figure",
        properties: {},
        children: [
          { type: "element", tagName: "img", properties, children: [] },
          {
            type: "element",
            tagName: "figcaption",
            properties: {},
            children: caption,
          },
        ],
      };
    },
  },
});

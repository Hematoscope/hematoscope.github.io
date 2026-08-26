import { defineHastPlugin } from "satteri";

/**
 * An image's markdown title becomes its caption: `![alt](./photo.jpg "The
 * caption")` renders as a `<figure>` with a `<figcaption>` rather than as an
 * `<img>` in a paragraph of its own.
 *
 * A title attribute is a hover tooltip and nothing else, so a caption written
 * there is invisible to anyone not holding a mouse over the image. The figure
 * makes it part of the post and ties it to the image it describes, which is
 * what an author writing one means by it. It is not a substitute for `alt`,
 * which still says what the image shows.
 *
 * Only a paragraph holding nothing but the image is converted. Prose wrapped
 * around an image is a sentence with a picture in it rather than a captioned
 * figure, and a `<figure>` cannot sit inside a `<p>` anyway.
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
      const children = (node.children ?? []).filter(
        (child) => !(child.type === "text" && child.value.trim() === ""),
      );
      const [image] = children;
      if (children.length !== 1 || image?.type !== "element") return;
      if (image.tagName !== "img") return;

      // Astro's image handling reads `src` off this node afterwards, so the
      // properties carry over. The title does not: it is the caption now, and
      // a tooltip repeating the line printed under the image is only noise.
      const { title, ...properties } = image.properties ?? {};
      if (typeof title !== "string" || !title) return;

      // A plain object rather than the visited node: Satteri materializes the
      // tree lazily, and only a fully built node can be handed back to it.
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
            children: [{ type: "text", value: title }],
          },
        ],
      };
    },
  },
});

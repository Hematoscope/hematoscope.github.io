/** @type {import("prettier").Config} */
export default {
  plugins: ["prettier-plugin-astro"],
  htmlWhitespaceSensitivity: "ignore",
  overrides: [{ files: "*.astro", options: { parser: "astro" } }],
};

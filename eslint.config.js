import eslintPluginAstro from 'eslint-plugin-astro';
import playwright from 'eslint-plugin-playwright'

export default [
  // add more generic rule sets here, such as:
  // js.configs.recommended,
  ...eslintPluginAstro.configs.recommended,
  ...eslintPluginAstro.configs['jsx-a11y-strict'],
  {
    rules: {
      "astro/jsx-a11y/no-redundant-roles": "off",
      "astro/jsx-a11y/media-has-caption": "off",
    }
  },
  {
    ...playwright.configs['flat/recommended'],
    files: ['tests/**'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
    },
  }
];

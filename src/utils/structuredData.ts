import type { ArticleMeta } from "~src/utils/opengraph";

/**
 * The site's structured data.
 *
 * None of this is required to appear in a generated answer: those read the
 * ordinary index, and there is no markup that unlocks them. What it does buy is
 * rich results, and one identity. "Cellbytes" is a coined compound, so nothing
 * outside this site can infer that the company on this domain, the one on
 * LinkedIn and the one named in a partner's announcement are the same thing.
 * `sameAs` and a stable `@id` are how that gets said once and referred to.
 *
 * Every value below is a fact already published on the site. Structured data
 * asserting something the page does not is worse than none: it is a claim
 * nobody can check against the page it sits on.
 */

/** Stable identifier for the organization, referred to from every other node. */
export const ORGANIZATION_ID = "https://cellbytes.io/#organization";

export function organization(site: URL): object {
  return {
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: "Cellbytes",
    legalName: "Cellbytes Ltd.",
    url: site.href,
    logo: new URL("/favicon.svg", site).href,
    sameAs: ["https://www.linkedin.com/company/cellbytes"],
    address: {
      "@type": "PostalAddress",
      streetAddress: "Tukholmankatu 8",
      postalCode: "00290",
      addressLocality: "Helsinki",
      addressCountry: "FI",
    },
  };
}

export function webSite(site: URL): object {
  return {
    "@type": "WebSite",
    "@id": `${site.origin}/#website`,
    url: site.href,
    name: "Cellbytes",
    publisher: { "@id": ORGANIZATION_ID },
    inLanguage: "en",
  };
}

export function blogPosting(
  article: ArticleMeta,
  page: { url: URL; title: string; description: string; image: URL },
): object {
  return {
    "@type": "BlogPosting",
    "@id": `${page.url.href}#article`,
    mainEntityOfPage: page.url.href,
    headline: page.title,
    description: page.description,
    image: page.image.href,
    datePublished: article.published.toISOString(),
    // Only stated when the history could answer. A dateModified guessed from
    // the published date would be a claim about a page nobody made.
    ...(article.modified
      ? { dateModified: article.modified.toISOString() }
      : {}),
    ...(article.author
      ? { author: { "@type": "Organization", name: article.author } }
      : { author: { "@id": ORGANIZATION_ID } }),
    publisher: { "@id": ORGANIZATION_ID },
    ...(article.tags?.length ? { keywords: article.tags.join(", ") } : {}),
    inLanguage: "en",
  };
}

/** Where a page sits, for the trail shown under a result. */
export function breadcrumbs(
  site: URL,
  trail: { name: string; path: string }[],
): object {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((step, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: step.name,
      item: new URL(step.path, site).href,
    })),
  };
}

/**
 * The product itself, described with what the application page already says it
 * is. It is browser-based and sold to laboratories rather than downloaded, so
 * there is no version, no platform and no price for this to state: an `offers`
 * block would be a claim the site does not make anywhere a reader can check.
 */
export function softwareApplication(site: URL, description: string): object {
  return {
    "@type": "SoftwareApplication",
    "@id": `${site.origin}/#application`,
    name: "Cellbytes",
    applicationCategory: "MedicalApplication",
    operatingSystem: "Web browser",
    description,
    url: new URL("/application", site).href,
    publisher: { "@id": ORGANIZATION_ID },
  };
}

/** One `@graph` holding everything a page declares, ready to serialize. */
export function graph(site: URL, nodes: object[]): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [organization(site), webSite(site), ...nodes],
  });
}

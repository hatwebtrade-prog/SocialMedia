export interface JsonLdArgs {
  titoloSeo: string;
  metaDescription: string;
  faq: { domanda: string; risposta: string }[];
}

/** Builds an Article + FAQPage JSON-LD graph as a JSON string (schema.org). Pure. */
export function buildArticleJsonLd({ titoloSeo, metaDescription, faq }: JsonLdArgs): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Article", headline: titoloSeo, description: metaDescription },
      {
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({
          "@type": "Question",
          name: f.domanda,
          acceptedAnswer: { "@type": "Answer", text: f.risposta },
        })),
      },
    ],
  });
}

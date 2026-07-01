export const COMPETITORS: string[] = ["natural System"];
export const NEUTRAL_REPLACEMENT = "un noto marchio concorrente";

export interface BlogPayloadTextFields {
  titoloSeo?: string;
  metaDescription?: string;
  corpoHtml?: string;
  cta?: string;
  keywordPrincipale?: string;
  keywordSecondarie?: string[];
  puntiChiave?: string[];
  faq?: { domanda: string; risposta: string }[];
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Tolerant regex for a competitor name: tokens joined by [\s-]* , case-insensitive, global. */
function competitorRegex(name: string): RegExp {
  const tokens = name.trim().split(/\s+/).filter(Boolean).map(escapeRegex);
  return new RegExp("\\b" + tokens.join("[\\s-]*") + "\\b", "gi");
}

export function scrubCompetitors(
  text: string,
  competitors: string[] = COMPETITORS,
  replacement: string = NEUTRAL_REPLACEMENT,
): string {
  if (typeof text !== "string" || text.length === 0) return text;
  let out = text;
  for (const c of competitors) {
    if (!c || !c.trim()) continue;
    out = out.replace(competitorRegex(c), replacement);
  }
  return out;
}

export function scrubBlogPayload<T extends BlogPayloadTextFields>(
  payload: T,
  competitors: string[] = COMPETITORS,
  replacement: string = NEUTRAL_REPLACEMENT,
): T {
  const s = (v: string | undefined) => (typeof v === "string" ? scrubCompetitors(v, competitors, replacement) : v);
  const arr = (a: string[] | undefined) => (Array.isArray(a) ? a.map((x) => scrubCompetitors(x, competitors, replacement)) : a);
  return {
    ...payload,
    titoloSeo: s(payload.titoloSeo),
    metaDescription: s(payload.metaDescription),
    corpoHtml: s(payload.corpoHtml),
    cta: s(payload.cta),
    keywordPrincipale: s(payload.keywordPrincipale),
    keywordSecondarie: arr(payload.keywordSecondarie),
    puntiChiave: arr(payload.puntiChiave),
    faq: Array.isArray(payload.faq)
      ? payload.faq.map((f) => ({
          ...f,
          domanda: scrubCompetitors(f.domanda, competitors, replacement),
          risposta: scrubCompetitors(f.risposta, competitors, replacement),
        }))
      : payload.faq,
  };
}

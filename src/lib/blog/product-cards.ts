export interface ProductCard { nome: string; descrizione: string; bullets: string[]; url: string; imageUrl: string | null }
export interface ProductCards { main: ProductCard | null; related: ProductCard[] }
export interface ProductRec {
  id?: string; nome: string; descrizione?: string | null; benefici?: string | null;
  handle?: string | null; url?: string | null; categoria?: string | null;
}

/** Extracts readable plain text from a value that may be a portable-text/AST JSON string
 *  (e.g. {"type":"root","children":[{"type":"text","value":"..."}]}), HTML, or plain text. */
export function plainText(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  let text = s;
  if (s[0] === "{" || s[0] === "[") {
    try {
      const parts: string[] = [];
      const walk = (n: unknown): void => {
        if (n == null) return;
        if (typeof n === "string") { parts.push(n); return; }
        if (Array.isArray(n)) { n.forEach(walk); return; }
        if (typeof n === "object") {
          const o = n as Record<string, unknown>;
          if (typeof o.value === "string") parts.push(o.value);
          else if (typeof o.text === "string") parts.push(o.text);
          if (o.children) walk(o.children);
        }
      };
      walk(JSON.parse(s));
      if (parts.length) text = parts.join(" ");
    } catch { /* not JSON: fall through */ }
  }
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** First sentence / ~180 chars of a (possibly JSON/HTML) description, single line. */
export function shortDescription(raw: string | null | undefined): string {
  const t = plainText(raw);
  if (t.length <= 180) return t;
  const cut = t.slice(0, 180);
  const dot = cut.lastIndexOf(". ");
  return dot > 80 ? cut.slice(0, dot + 1) : `${cut.trim()}…`;
}

export function benefitsToBullets(benefici: string | null | undefined, cap = 3): string[] {
  const raw = (benefici ?? "").trim();
  if (!raw) return [];
  // JSON AST → extract text first (loses newlines); plain/HTML → split the raw to keep newline splits.
  const source = raw[0] === "{" || raw[0] === "[" ? plainText(raw) : raw;
  return source
    .split(/[\n;•]|\.\s/)
    .map((s) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, cap);
}

function toCard(rec: ProductRec, shopifyByHandle: Record<string, { imageUrl: string | null; url: string }>): ProductCard {
  const sh = rec.handle ? shopifyByHandle[rec.handle] : undefined;
  return {
    nome: rec.nome,
    descrizione: shortDescription(rec.descrizione),
    bullets: benefitsToBullets(rec.benefici),
    url: sh?.url ?? rec.url ?? "",
    imageUrl: sh?.imageUrl ?? null,
  };
}

export function buildProductCards(args: {
  main: ProductRec | null;
  sameCategory: ProductRec[];
  shopifyByHandle: Record<string, { imageUrl: string | null; url: string }>;
  cap?: number;
}): ProductCards {
  const cap = args.cap ?? 3;
  const main = args.main ? toCard(args.main, args.shopifyByHandle) : null;
  const mainHandle = args.main?.handle ?? null;
  const related = args.sameCategory
    .filter((r) => !mainHandle || r.handle !== mainHandle)
    .slice(0, cap)
    .map((r) => toCard(r, args.shopifyByHandle));
  return { main, related };
}

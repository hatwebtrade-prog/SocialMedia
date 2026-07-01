export interface ProductCard { nome: string; descrizione: string; bullets: string[]; url: string; imageUrl: string | null }
export interface ProductCards { main: ProductCard | null; related: ProductCard[] }
export interface ProductRec {
  id?: string; nome: string; descrizione?: string | null; benefici?: string | null;
  handle?: string | null; url?: string | null; categoria?: string | null;
}

export function benefitsToBullets(benefici: string | null | undefined, cap = 3): string[] {
  if (!benefici) return [];
  return benefici
    .split(/[\n;•]|\.\s/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, cap);
}

function toCard(rec: ProductRec, shopifyByHandle: Record<string, { imageUrl: string | null; url: string }>): ProductCard {
  const sh = rec.handle ? shopifyByHandle[rec.handle] : undefined;
  return {
    nome: rec.nome,
    descrizione: (rec.descrizione ?? "").trim(),
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

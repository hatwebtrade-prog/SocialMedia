export interface KbProduct {
  nome: string;
  categoria: string | null;
  descrizione: string | null;
  benefici: string | null;
  ingredienti: string | null;
  target: string | null;
  url: string | null;
}

export interface KbItem {
  tipo: string;
  titolo: string;
  contenuto: string;
}

export interface KbInput {
  products: KbProduct[];
  knowledge: KbItem[];
}

export function buildKbContext({ products, knowledge }: KbInput): string {
  if (products.length === 0 && knowledge.length === 0) {
    return "Nessun materiale di knowledge base disponibile.";
  }

  const lines: string[] = [];

  if (products.length > 0) {
    lines.push("## Prodotti Agocap");
    for (const p of products) {
      lines.push(`- ${p.nome}${p.categoria ? ` (${p.categoria})` : ""}`);
      if (p.descrizione) lines.push(`  Descrizione: ${p.descrizione}`);
      if (p.benefici) lines.push(`  Benefici: ${p.benefici}`);
      if (p.ingredienti) lines.push(`  Ingredienti: ${p.ingredienti}`);
      if (p.target) lines.push(`  Target: ${p.target}`);
    }
  }

  if (knowledge.length > 0) {
    lines.push("## Knowledge base");
    for (const k of knowledge) {
      lines.push(`- [${k.tipo}] ${k.titolo}: ${k.contenuto}`);
    }
  }

  return lines.join("\n");
}

import type { ProductCard, ProductCards } from "./product-cards";

export interface BlogPayloadLike {
  corpoHtml?: string;
  puntiChiave?: string[];
  faq?: { domanda: string; risposta: string }[];
  cta?: string;
}

export interface AssembleOpts { headerSrc?: string | null; cards?: ProductCards }

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const STYLE = `<style>
.ag-article{max-width:740px;margin:32px auto;padding:0 20px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#2b3d4e;line-height:1.7;font-size:17px;}
.ag-article h1{font-size:33px;line-height:1.2;font-weight:800;margin:0 0 10px;}
.ag-article h2{font-size:24px;font-weight:800;margin:34px 0 12px;}
.ag-header{width:100%;max-height:200px;object-fit:cover;border-radius:16px;display:block;margin-bottom:24px;}
.ag-summary{background:#f2f9f7;border-left:4px solid #a9d9cb;border-radius:14px;padding:18px 20px;margin:0 0 30px;}
.ag-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px;}
.ag-card{background:#fff;border:1px solid #e7f2ef;border-radius:20px;padding:22px;box-shadow:0 10px 28px rgba(43,61,78,.08);display:flex;flex-direction:column;align-items:center;text-align:center;transition:transform .25s ease,box-shadow .25s ease;}
.ag-card:hover{transform:translateY(-6px);box-shadow:0 20px 44px rgba(43,61,78,.16);}
.ag-imgwrap{background:#f8fbfa;border-radius:18px;padding:18px;width:100%;box-sizing:border-box;margin-bottom:18px;overflow:hidden;}
.ag-imgwrap img{width:100%;max-width:250px;height:auto;display:block;margin:0 auto;transition:transform .35s ease;}
.ag-card:hover .ag-imgwrap img{transform:scale(1.05);}
.ag-btn{display:inline-block;width:100%;box-sizing:border-box;padding:14px 18px;background:#a9d9cb;color:#2b3d4e;text-decoration:none;border-radius:999px;font-size:15px;font-weight:800;transition:background .2s ease,transform .15s ease;}
.ag-btn:hover{background:#8fccba;transform:translateY(-1px);}
.ag-mid{display:block;margin:30px 0;text-decoration:none;color:inherit;}
.ag-midcard{display:flex;gap:18px;align-items:center;border:1px solid #e7f2ef;background:#fff;border-radius:20px;padding:18px;box-shadow:0 10px 28px rgba(43,61,78,.08);transition:transform .25s ease,box-shadow .25s ease;}
.ag-mid:hover .ag-midcard{transform:translateY(-4px);box-shadow:0 18px 40px rgba(43,61,78,.15);}
.ag-pill{display:inline-block;background:#a9d9cb;color:#2b3d4e;font-weight:800;font-size:14px;padding:9px 16px;border-radius:999px;transition:background .2s ease;}
.ag-mid:hover .ag-pill{background:#8fccba;}
.ag-final{margin:40px 0 8px;padding-top:26px;border-top:1px solid #e7f2ef;}
.ag-fade{opacity:0;transform:translateY(10px);animation:agfade .6s ease forwards;}
@keyframes agfade{to{opacity:1;transform:none;}}
</style>`;

function summaryHtml(points?: string[]): string {
  if (!points || points.length === 0) return "";
  const rows = points.map((p) => `✓ ${escapeHtml(p)}`).join("<br>");
  return `<div class="ag-summary"><div style="font-weight:800;color:#2b3d4e;margin-bottom:10px;font-size:14px;letter-spacing:.03em;text-transform:uppercase;">In sintesi</div><p style="margin:0;color:#566b7a;font-size:15px;line-height:1.7;">${rows}</p></div>`;
}

function imgWrap(card: ProductCard): string {
  if (!card.imageUrl) return "";
  return `<div class="ag-imgwrap"><img alt="${escapeHtml(card.nome)}" src="${escapeHtml(card.imageUrl)}"></div>`;
}

function bulletsHtml(card: ProductCard): string {
  if (card.bullets.length === 0) return "";
  const rows = card.bullets.map((b) => `✓ ${escapeHtml(b)}`).join("<br>");
  return `<div style="width:100%;margin:0 0 20px;text-align:left;"><p style="margin:0 0 8px;font-size:14px;font-weight:bold;">Ideale se cerchi:</p><p style="margin:0;color:#566b7a;font-size:14px;line-height:1.6;">${rows}</p></div>`;
}

function productCardHtml(card: ProductCard): string {
  return `<div class="ag-card">${imgWrap(card)}<h3 style="margin:0 0 10px;color:#2b3d4e;font-size:21px;line-height:1.25;font-weight:800;">${escapeHtml(card.nome)}</h3><p style="margin:0 0 16px;color:#566b7a;font-size:15px;line-height:1.55;">${escapeHtml(card.descrizione)}</p>${bulletsHtml(card)}<a class="ag-btn" href="${escapeHtml(card.url)}">Scopri ${escapeHtml(card.nome)}</a></div>`;
}

function mainCardHtml(card: ProductCard): string {
  const img = card.imageUrl
    ? `<img src="${escapeHtml(card.imageUrl)}" alt="${escapeHtml(card.nome)}" style="width:110px;height:110px;object-fit:cover;border-radius:14px;flex-shrink:0;background:#f8fbfa;">`
    : "";
  return `<a class="ag-mid" href="${escapeHtml(card.url)}"><div class="ag-midcard">${img}<div style="min-width:0;"><div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#79a99b;font-weight:800;margin-bottom:4px;">Prodotto consigliato</div><div style="font-size:20px;font-weight:800;margin-bottom:4px;">${escapeHtml(card.nome)}</div><div style="color:#566b7a;font-size:15px;margin-bottom:12px;">${escapeHtml(card.descrizione)}</div><span class="ag-pill">Scopri il prodotto →</span></div></div></a>`;
}

function faqHtml(faq?: { domanda: string; risposta: string }[]): string {
  if (!faq || faq.length === 0) return "";
  const items = faq
    .map((f) => `<div style="border:1px solid #e7f2ef;border-radius:12px;padding:16px 18px;margin-bottom:10px;"><div style="font-weight:800;margin-bottom:6px;">${escapeHtml(f.domanda)}</div><div style="color:#566b7a;">${escapeHtml(f.risposta)}</div></div>`)
    .join("");
  return `<h2>Domande frequenti</h2>${items}`;
}

function ctaHtml(cta?: string): string {
  if (!cta || !cta.trim()) return "";
  return `<p style="margin:24px 0;font-weight:700;">${escapeHtml(cta)}</p>`;
}

function relatedAreaHtml(related: ProductCard[]): string {
  if (related.length === 0) return "";
  const cards = related.map((c, i) => productCardHtml(c).replace('class="ag-card"', `class="ag-card ag-fade" style="animation-delay:.${i}s;"`)).join("");
  return `<div class="ag-final"><h2 style="margin:0 0 4px;">Prodotti consigliati per questo articolo</h2><p style="color:#566b7a;font-size:15px;margin:0 0 20px;">Selezionati in base al tema trattato.</p><div class="ag-grid">${cards}</div></div>`;
}

/** Inserts `block` after the block-level closing tag nearest the character midpoint of `html`. */
export function injectAtMidpoint(html: string, block: string): string {
  const closers = [...html.matchAll(/<\/(p|h2|h3|ul|ol|blockquote)>/gi)];
  if (closers.length === 0) return html + block;
  const mid = html.length / 2;
  let best = closers[0];
  for (const m of closers) {
    if (Math.abs((m.index ?? 0) - mid) < Math.abs((best.index ?? 0) - mid)) best = m;
  }
  const pos = (best.index ?? 0) + best[0].length;
  return html.slice(0, pos) + block + html.slice(pos);
}

export function assembleArticleHtml(payload: BlogPayloadLike, opts: AssembleOpts = {}): string {
  const cards = opts.cards;
  const header = opts.headerSrc ? `<img class="ag-header" src="${escapeHtml(opts.headerSrc)}" alt="">` : "";
  let body = payload.corpoHtml ?? "";
  if (cards?.main) body = injectAtMidpoint(body, mainCardHtml(cards.main));
  const inner = [
    header,
    summaryHtml(payload.puntiChiave),
    body,
    faqHtml(payload.faq),
    ctaHtml(payload.cta),
    cards ? relatedAreaHtml(cards.related) : "",
  ].join("");
  return `${STYLE}<article class="ag-article">${inner}</article>`;
}

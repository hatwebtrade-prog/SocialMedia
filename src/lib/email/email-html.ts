export interface EmailPayloadLike { corpoHtml?: string; cta?: string }
export interface CrossSellItem { nome: string; url: string; imageUrl: string | null }
export interface EmailBlocks { productImages: string[]; crossSell: CrossSellItem[] }

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const TD_TEXT = 'style="padding:10px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#2b3d4e;"';

export function splitParagraphs(html: string): string[] {
  const s = (html ?? "").trim();
  if (!s) return [];
  if (/<\/p>/i.test(s)) return s.split(/(?<=<\/p>)/i).map((x) => x.trim()).filter(Boolean);
  return s.split(/(?:<br\s*\/?>\s*){2,}|\n{2,}/i).map((x) => x.trim()).filter(Boolean);
}

function imageRow(src: string): string {
  return `<tr><td align="center" style="padding:16px 0;"><img src="${escapeHtml(src)}" alt="" width="560" style="max-width:100%;height:auto;border-radius:8px;display:block;margin:0 auto;"></td></tr>`;
}

export function injectImagesBetweenParagraphs(paragraphs: string[], images: string[]): string[] {
  const imgs = (images ?? []).slice(0, 3);
  const rows: string[] = [];
  const step = imgs.length > 0 ? Math.max(1, Math.floor(paragraphs.length / (imgs.length + 1))) : 0;
  let placed = 0;
  paragraphs.forEach((p, i) => {
    rows.push(`<tr><td ${TD_TEXT}>${p}</td></tr>`);
    if (step > 0 && placed < imgs.length && (i + 1) % step === 0 && i < paragraphs.length - 1) {
      rows.push(imageRow(imgs[placed]));
      placed++;
    }
  });
  while (placed < imgs.length) { rows.push(imageRow(imgs[placed])); placed++; }
  return rows;
}

function crossSellTable(items: CrossSellItem[]): string {
  if (!items || items.length === 0) return "";
  const cards = items
    .map((it) => {
      const img = it.imageUrl
        ? `<img src="${escapeHtml(it.imageUrl)}" alt="${escapeHtml(it.nome)}" width="120" style="max-width:120px;height:auto;border-radius:8px;display:block;margin:0 auto 8px;">`
        : "";
      return `<td align="center" valign="top" style="padding:8px;font-family:Arial,Helvetica,sans-serif;">${img}<div style="font-size:14px;font-weight:bold;color:#2b3d4e;margin-bottom:8px;">${escapeHtml(it.nome)}</div><a href="${escapeHtml(it.url)}" style="display:inline-block;background:#a9d9cb;color:#2b3d4e;text-decoration:none;font-weight:bold;font-size:13px;padding:8px 14px;border-radius:999px;">Scopri &rarr;</a></td>`;
    })
    .join("");
  return `<tr><td style="padding:24px 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:bold;color:#2b3d4e;border-top:1px solid #e7f2ef;">Ti potrebbero interessare</td></tr><tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${cards}</tr></table></td></tr>`;
}

function ctaRow(cta: string | undefined): string {
  if (!cta || !cta.trim()) return "";
  return `<tr><td align="center" style="padding:24px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#2b3d4e;">${escapeHtml(cta)}</td></tr>`;
}

export function assembleEmailHtml(payload: EmailPayloadLike, blocks: EmailBlocks): string {
  const paragraphs = splitParagraphs(payload.corpoHtml ?? "");
  const bodyRows = injectImagesBetweenParagraphs(paragraphs, blocks.productImages ?? []).join("");
  const cta = ctaRow(payload.cta);
  const cross = crossSellTable(blocks.crossSell ?? []);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f8f7;"><tr><td align="center" style="padding:20px;"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;padding:24px;">${bodyRows}${cta}${cross}</table></td></tr></table>`;
}

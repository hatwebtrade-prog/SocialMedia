import { describe, it, expect } from "vitest";
import { assembleArticleHtml, escapeHtml } from "@/lib/blog/article-html";

const cards = {
  main: { nome: "Magnesio", descrizione: "desc", bullets: ["A", "B"], url: "https://s/products/magnesio", imageUrl: "https://cdn/mag.jpg" },
  related: [
    { nome: "Melatonina", descrizione: "mel", bullets: ["C"], url: "https://s/products/melatonina", imageUrl: "https://cdn/mel.jpg" },
  ],
};
const payload = { corpoHtml: "<p>uno</p><p>due</p><p>tre</p><p>quattro</p>", puntiChiave: ["k1"], faq: [{ domanda: "D?", risposta: "R" }], cta: "Compra ora" };

describe("assembleArticleHtml", () => {
  it("emits the scoped style block with the hover rule", () => {
    const html = assembleArticleHtml(payload, { cards });
    expect(html).toContain("<style>");
    expect(html).toContain(".ag-card:hover");
    expect(html).toContain('class="ag-article"');
  });
  it("renders the slim header only when headerSrc is present", () => {
    expect(assembleArticleHtml(payload, { headerSrc: "data:image/jpeg;base64,zz", cards }))
      .toContain('class="ag-header" src="data:image/jpeg;base64,zz"');
    expect(assembleArticleHtml(payload, { cards })).not.toContain('class="ag-header"');
  });
  it("injects the main product card mid-article with the product link", () => {
    const html = assembleArticleHtml(payload, { cards });
    expect(html).toContain('class="ag-midcard"');
    expect(html).toContain('href="https://s/products/magnesio"');
  });
  it("renders the related area with a card per related product", () => {
    const html = assembleArticleHtml(payload, { cards });
    expect(html).toContain("Prodotti consigliati per questo articolo");
    expect(html).toContain('href="https://s/products/melatonina"');
    expect(html).toContain("Melatonina");
  });
  it("omits cards entirely when none are provided", () => {
    const html = assembleArticleHtml(payload, {});
    expect(html).not.toContain('class="ag-midcard"');
    expect(html).not.toContain("Prodotti consigliati");
    expect(html).toContain("<p>uno</p>");
  });
  it("escapes data-derived text", () => {
    const html = assembleArticleHtml(payload, { cards: { main: { nome: 'X<script>"', descrizione: "", bullets: [], url: "u", imageUrl: null }, related: [] } });
    expect(html).toContain("X&lt;script&gt;&quot;");
  });
});

describe("escapeHtml", () => {
  it("escapes the dangerous characters", () => {
    expect(escapeHtml('a<b>&"\'')).toBe("a&lt;b&gt;&amp;&quot;&#39;");
  });
});

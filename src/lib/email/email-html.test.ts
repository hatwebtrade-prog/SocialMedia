import { describe, it, expect } from "vitest";
import { assembleEmailHtml, splitParagraphs, injectImagesBetweenParagraphs, escapeHtml } from "@/lib/email/email-html";

describe("splitParagraphs", () => {
  it("splits on </p>", () => {
    expect(splitParagraphs("<p>a</p><p>b</p>")).toEqual(["<p>a</p>", "<p>b</p>"]);
  });
  it("splits on blank lines when no <p>", () => {
    expect(splitParagraphs("uno\n\ndue")).toEqual(["uno", "due"]);
  });
  it("empty -> []", () => { expect(splitParagraphs("")).toEqual([]); });
});

describe("injectImagesBetweenParagraphs", () => {
  it("interleaves the provided images among paragraphs", () => {
    const joined = injectImagesBetweenParagraphs(["<p>1</p>","<p>2</p>","<p>3</p>","<p>4</p>"], ["i1","i2"]).join("");
    expect((joined.match(/<img /g) || []).length).toBe(2);
    expect(joined).toContain('src="i1"');
  });
  it("caps at 3 images", () => {
    const joined = injectImagesBetweenParagraphs(["<p>1</p>","<p>2</p>"], ["i1","i2","i3","i4"]).join("");
    expect((joined.match(/<img /g) || []).length).toBe(3);
  });
  it("no images -> no <img>", () => {
    expect(injectImagesBetweenParagraphs(["<p>1</p>"], []).join("")).not.toContain("<img");
  });
  it("spreads images across the body, not all front-loaded", () => {
    const paras = ["<p>0</p>","<p>1</p>","<p>2</p>","<p>3</p>","<p>4</p>","<p>5</p>","<p>6</p>"];
    const html = injectImagesBetweenParagraphs(paras, ["i0","i1","i2"]).join("");
    const idxP4 = html.indexOf("<p>4</p>");
    const idxLastImg = html.lastIndexOf('src="i2"');
    expect(idxLastImg).toBeGreaterThan(idxP4);
  });
});

describe("assembleEmailHtml", () => {
  const payload = { corpoHtml: "<p>uno</p><p>due</p><p>tre</p>", cta: "Acquista ora" };
  const blocks = { productImages: ["https://cdn/a.jpg", "https://cdn/b.jpg"], crossSell: [{ nome: "Magnesio", url: "https://s/products/magnesio", imageUrl: "https://cdn/m.jpg" }] };
  it("is email-safe: tables + inline styles, no <style>", () => {
    const html = assembleEmailHtml(payload, blocks);
    expect(html).toContain("<table");
    expect(html).not.toContain("<style");
  });
  it("includes product images and cross-sell with product link", () => {
    const html = assembleEmailHtml(payload, blocks);
    expect(html).toContain("https://cdn/a.jpg");
    expect(html).toContain("Ti potrebbero interessare");
    expect(html).toContain("https://s/products/magnesio");
    expect(html).toContain("Magnesio");
  });
  it("omits cross-sell when empty and images when none", () => {
    const html = assembleEmailHtml({ corpoHtml: "<p>x</p>" }, { productImages: [], crossSell: [] });
    expect(html).not.toContain("Ti potrebbero interessare");
    expect(html).not.toContain("<img");
  });
  it("escapes data-derived text", () => {
    const html = assembleEmailHtml({ corpoHtml: "<p>x</p>" }, { productImages: [], crossSell: [{ nome: 'X<script>"', url: "u", imageUrl: null }] });
    expect(html).toContain("X&lt;script&gt;&quot;");
  });
});

describe("escapeHtml", () => {
  it("escapes", () => { expect(escapeHtml('a<b>&"\'')).toBe("a&lt;b&gt;&amp;&quot;&#39;"); });
});

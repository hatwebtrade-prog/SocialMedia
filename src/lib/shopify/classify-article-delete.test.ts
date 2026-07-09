import { describe, it, expect } from "vitest";
import { classifyArticleDelete } from "@/lib/shopify/publish";

describe("classifyArticleDelete", () => {
  it("returns ok on deletedArticleId", () => {
    expect(classifyArticleDelete({ data: { articleDelete: { deletedArticleId: "gid://shopify/Article/1" } } })).toEqual({ ok: true, notFound: false });
  });
  it("throws on a top-level GraphQL error (mutation unavailable)", () => {
    expect(() => classifyArticleDelete({ errors: [{ message: "Field 'articleDelete' doesn't exist on type 'Mutation'" }] })).toThrow(/articleDelete/);
  });
  it("treats an article-level not-found userError as idempotent success", () => {
    expect(classifyArticleDelete({ data: { articleDelete: { deletedArticleId: null, userErrors: [{ message: "Article does not exist" }] } } })).toEqual({ ok: true, notFound: true });
  });
  it("throws on an unknown/empty outcome", () => {
    expect(() => classifyArticleDelete({ data: { articleDelete: { deletedArticleId: null, userErrors: [] } } })).toThrow(/esito sconosciuto/);
  });
  it("throws on a real article-level userError that is not a not-found", () => {
    expect(() => classifyArticleDelete({ data: { articleDelete: { deletedArticleId: null, userErrors: [{ message: "Access denied" }] } } })).toThrow(/Access denied/);
  });
});

import { describe, it, expect } from "vitest";
import { emailSchema } from "@/lib/email/schema";

const valid = { oggetto: "Sconto magnesio", preheader: "Solo oggi", corpoHtml: "<p>ciao</p>", cta: "Acquista", prodotti: [{ handle: "mg", titolo: "Mg", url: "https://x/products/mg" }] };

describe("emailSchema", () => {
  it("accepts a valid email", () => {
    expect(emailSchema.parse(valid).oggetto).toBe("Sconto magnesio");
  });
  it("rejects empty oggetto/corpoHtml", () => {
    expect(() => emailSchema.parse({ ...valid, oggetto: "" })).toThrow();
    expect(() => emailSchema.parse({ ...valid, corpoHtml: "" })).toThrow();
  });
});

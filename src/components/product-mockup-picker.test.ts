import { describe, it, expect } from "vitest";
import { withProduct, withMockup } from "@/components/product-mockup-picker";

describe("withProduct", () => {
  it("keeps useMockup when switching to another product", () => {
    expect(withProduct({ productId: "p1", useMockup: true }, "p2")).toEqual({ productId: "p2", useMockup: true });
  });
  it("forces useMockup off when the product is cleared", () => {
    expect(withProduct({ productId: "p1", useMockup: true }, "")).toEqual({ productId: "", useMockup: false });
  });
});

describe("withMockup", () => {
  it("enables the mockup when a product is selected", () => {
    expect(withMockup({ productId: "p1", useMockup: false }, true)).toEqual({ productId: "p1", useMockup: true });
  });
  it("cannot enable the mockup without a product", () => {
    expect(withMockup({ productId: "", useMockup: false }, true)).toEqual({ productId: "", useMockup: false });
  });
});

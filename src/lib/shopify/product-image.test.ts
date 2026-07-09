import { describe, it, expect } from "vitest";
import { productImageRelPath } from "@/lib/shopify/product-image";

describe("productImageRelPath", () => {
  it("builds a stable uploads path per handle", () => {
    expect(productImageRelPath("magnesio-supremo").replace(/\\/g, "/")).toBe("uploads/products/magnesio-supremo.png");
  });
  it("sanitises unsafe handle characters", () => {
    expect(productImageRelPath("a/b c").replace(/\\/g, "/")).toBe("uploads/products/a-b-c.png");
  });
});

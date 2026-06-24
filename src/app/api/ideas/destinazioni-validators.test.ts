import { describe, it, expect } from "vitest";
import { bulkDestinazioniSchema, updateIdeaSchema } from "@/app/api/ideas/validators";

describe("destinazioni validators", () => {
  it("updateIdeaSchema accepts destinazioni", () => {
    expect(updateIdeaSchema.parse({ destinazioni: ["META", "BLOG"] }).destinazioni).toEqual(["META", "BLOG"]);
  });
  it("bulkDestinazioniSchema requires ids and valid channels", () => {
    expect(bulkDestinazioniSchema.parse({ ids: ["i1"], destinazioni: ["TIKTOK"] }).destinazioni).toEqual(["TIKTOK"]);
    expect(() => bulkDestinazioniSchema.parse({ ids: [], destinazioni: ["META"] })).toThrow();
    expect(() => bulkDestinazioniSchema.parse({ ids: ["i1"], destinazioni: ["XYZ"] })).toThrow();
  });
});

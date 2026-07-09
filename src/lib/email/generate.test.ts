import { describe, it, expect, vi } from "vitest";
import { generateEmail } from "@/lib/email/generate";

const payload = { oggetto: "O", preheader: "p", corpoHtml: "<p>x</p>", cta: "c", prodotti: [] };

function makeDeps(overrides = {}) {
  return {
    loadContext: vi.fn().mockResolvedValue({ idea: { titolo: "T", descrizione: "d", category: "EDUCATIONAL" }, kbContext: "kb", prodotti: [] }),
    callClaude: vi.fn().mockResolvedValue({ payload, promptUsato: "P", modello: "claude-opus-4-8", inputTokens: 1, outputTokens: 1, rawOutput: {} }),
    persist: vi.fn().mockResolvedValue({ contentId: "c1" }),
    ...overrides,
  };
}

describe("generateEmail", () => {
  it("DONE → persists the email", async () => {
    const deps = makeDeps();
    const res = await generateEmail({ ideaId: "i1", formato: "NEWSLETTER" }, deps as any);
    expect(res.status).toBe("DONE");
    expect(res.contentId).toBe("c1");
    expect((deps.callClaude as any).mock.calls[0][0].formato).toBe("NEWSLETTER");
  });
  it("ERROR when Claude throws (nothing persisted)", async () => {
    const deps = makeDeps({ callClaude: vi.fn().mockRejectedValue(new Error("AI down")) });
    const res = await generateEmail({ ideaId: "i1", formato: "PROMO_EMAIL" }, deps as any);
    expect(res.status).toBe("ERROR");
    expect(deps.persist).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, afterEach } from "vitest";
import { checkWebhookSecret } from "@/lib/publications/auth";

const req = (secret?: string) => new Request("http://t/x", secret ? { headers: { "x-webhook-secret": secret } } : undefined);

describe("checkWebhookSecret", () => {
  afterEach(() => { delete process.env.N8N_WEBHOOK_SECRET; });
  it("true when header matches env", () => {
    process.env.N8N_WEBHOOK_SECRET = "s3cret";
    expect(checkWebhookSecret(req("s3cret"))).toBe(true);
  });
  it("false when missing/mismatch/unset", () => {
    process.env.N8N_WEBHOOK_SECRET = "s3cret";
    expect(checkWebhookSecret(req("nope"))).toBe(false);
    expect(checkWebhookSecret(req())).toBe(false);
    delete process.env.N8N_WEBHOOK_SECRET;
    expect(checkWebhookSecret(req("s3cret"))).toBe(false);
  });
});

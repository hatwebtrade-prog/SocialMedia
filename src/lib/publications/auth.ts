/** True only when N8N_WEBHOOK_SECRET is set AND the x-webhook-secret header matches it. */
export function checkWebhookSecret(request: Request): boolean {
  const expected = process.env.N8N_WEBHOOK_SECRET;
  if (!expected) return false;
  return request.headers.get("x-webhook-secret") === expected;
}

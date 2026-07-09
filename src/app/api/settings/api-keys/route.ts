import { NextResponse } from "next/server";
import { z } from "zod";
import { getSettingsMap, setSetting } from "@/lib/settings/store";

const ALLOWED_KEYS = [
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "SEOZOOM_API_KEY",
  "N8N_WEBHOOK_URL",
  "SHOPIFY_SHOP_DOMAIN",
  "SHOPIFY_ADMIN_TOKEN",
  "META_PAGE_ACCESS_TOKEN",
  "META_FACEBOOK_PAGE_ID",
  "META_INSTAGRAM_ACCOUNT_ID",
  "META_API_VERSION",
] as const;

// Chiavi sensibili: nel GET vengono mascherate (mai restituite in chiaro).
const SECRET_KEYS = new Set<string>([
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "SEOZOOM_API_KEY",
  "SHOPIFY_ADMIN_TOKEN",
  "META_PAGE_ACCESS_TOKEN",
]);

function mask(v: string): string {
  if (!v) return "";
  return v.length <= 4 ? "••••" : `••••${v.slice(-4)}`;
}

export async function GET() {
  const dbMap = await getSettingsMap([...ALLOWED_KEYS]);
  const items = ALLOWED_KEYS.map((key) => {
    const dbVal = dbMap[key];
    const envVal = process.env[key] || "";
    const effective = dbVal || envVal;
    const isSecret = SECRET_KEYS.has(key);
    return {
      key,
      set: !!effective,
      source: dbVal ? "db" : envVal ? "env" : "none",
      // valori non-segreti mostrati in chiaro (modificabili); segreti solo mascherati
      value: isSecret ? "" : effective,
      preview: isSecret ? mask(effective) : effective,
      isSecret,
    };
  });
  return NextResponse.json({ items });
}

const bodySchema = z.object({
  key: z.enum(ALLOWED_KEYS),
  value: z.string(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Chiave non valida" }, { status: 400 });
  await setSetting(parsed.data.key, parsed.data.value);
  return NextResponse.json({ ok: true });
}

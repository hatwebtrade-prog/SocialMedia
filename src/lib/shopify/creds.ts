import { getSettingsMap } from "@/lib/settings/store";

export interface ShopifyCreds {
  shop: string;
  token: string;
  version: string;
  storeUrl: string;
}

/** Credenziali Shopify: DB (AppSetting) con precedenza, altrimenti .env. */
export async function shopifyCreds(): Promise<ShopifyCreds> {
  const m = await getSettingsMap(["SHOPIFY_SHOP_DOMAIN", "SHOPIFY_ADMIN_TOKEN"]);
  const shop = m.SHOPIFY_SHOP_DOMAIN || process.env.SHOPIFY_SHOP_DOMAIN || "";
  const token = m.SHOPIFY_ADMIN_TOKEN || process.env.SHOPIFY_ADMIN_TOKEN || "";
  if (!shop || !token) throw new Error("SHOPIFY_SHOP_DOMAIN o SHOPIFY_ADMIN_TOKEN mancante (Impostazioni → Chiavi API o .env)");
  const version = process.env.SHOPIFY_API_VERSION ?? "2024-10";
  const storeUrl = process.env.SHOPIFY_STORE_URL || `https://${shop}`;
  return { shop, token, version, storeUrl };
}

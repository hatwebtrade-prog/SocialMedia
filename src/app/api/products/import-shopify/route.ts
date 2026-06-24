import { NextResponse } from "next/server";
import { importShopifyProducts } from "@/lib/shopify/import-products";

export async function POST() {
  try {
    const result = await importShopifyProducts();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore import Shopify" }, { status: 502 });
  }
}

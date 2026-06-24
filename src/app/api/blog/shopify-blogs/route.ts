import { NextResponse } from "next/server";
import { fetchBlogs } from "@/lib/shopify/publish";

export async function GET() {
  try {
    return NextResponse.json(await fetchBlogs());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Errore Shopify" }, { status: 502 });
  }
}

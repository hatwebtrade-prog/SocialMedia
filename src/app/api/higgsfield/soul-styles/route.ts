import { NextResponse } from "next/server";
import { listSoulStyles } from "@/lib/image/providers/higgsfield";

export async function GET() {
  const styles = await listSoulStyles();
  return NextResponse.json(styles);
}

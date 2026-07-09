import { NextResponse } from "next/server";
import { discoverKeywords } from "@/lib/seozoom/discover";
import { buildSeozoomDeps } from "@/lib/seozoom/runtime";
import { discoverInputSchema } from "../validators";
import { getDepsFactory } from "./deps-registry";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }
  const parsed = discoverInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Input non valido", details: parsed.error.flatten() }, { status: 400 });
  }

  const injected = getDepsFactory()();
  const run = injected.__run ?? discoverKeywords;
  const deps = injected.__run ? ({} as never) : buildSeozoomDeps();

  const result = await run(parsed.data, deps);
  return NextResponse.json(result, { status: result.status === "ERROR" ? 502 : 200 });
}

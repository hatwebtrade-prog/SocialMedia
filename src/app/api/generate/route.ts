import { NextResponse } from "next/server";
import { z } from "zod";
import { runBrainstorm } from "@/lib/brain/generate";
import { buildRuntimeDeps } from "@/lib/brain/runtime";
import { getDepsFactory } from "./deps-registry";
import { DESTINAZIONI } from "@/lib/brain/enums";

const inputSchema = z.object({
  prodotto: z.string().optional(),
  categoria: z.string().optional(),
  angolo: z.string().optional(),
  keywordSeed: z.string().optional(),
  destinazioni: z.array(z.enum(DESTINAZIONI)).optional(),
  count: z.number().int().min(1).max(20),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }

  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Input non valido", details: parsed.error.flatten() }, { status: 400 });
  }

  const injected = getDepsFactory()();
  const run = injected.__run ?? runBrainstorm;
  const deps = injected.__run ? ({} as never) : buildRuntimeDeps();

  const result = await run(parsed.data, deps);
  return NextResponse.json(result, { status: result.status === "ERROR" ? 502 : 200 });
}

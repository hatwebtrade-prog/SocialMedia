import { NextResponse } from "next/server";
import { generateEmail } from "@/lib/email/generate";
import { buildEmailDeps } from "@/lib/email/runtime";
import { emailGenerateSchema } from "../validators";
import { getDepsFactory } from "./deps-registry";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON non valido" }, { status: 400 }); }
  const parsed = emailGenerateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Input non valido", details: parsed.error.flatten() }, { status: 400 });

  const injected = getDepsFactory()();
  const run = injected.__run ?? generateEmail;
  const deps = injected.__run ? ({} as never) : buildEmailDeps();

  const result = await run(parsed.data, deps);
  return NextResponse.json(result, { status: result.status === "ERROR" ? 502 : 200 });
}

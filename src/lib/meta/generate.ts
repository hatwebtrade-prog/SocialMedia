import type { ContentFormatValue, MetaPlatformValue } from "./enums";
import type { MetaPromptIdea } from "./prompt";

export interface MetaGenInput {
  ideaId: string;
  formato: ContentFormatValue;
  piattaforme: MetaPlatformValue[];
  numeroSlide?: number;
}

export interface MetaClaudeResult {
  payload: object;
  promptUsato: string;
  modello: string;
  inputTokens: number;
  outputTokens: number;
  rawOutput: unknown;
}

export interface MetaDeps {
  loadContext: (ideaId: string) => Promise<{ idea: MetaPromptIdea; kbContext: string }>;
  callClaude: (args: {
    idea: MetaPromptIdea;
    kbContext: string;
    input: MetaGenInput;
  }) => Promise<MetaClaudeResult>;
  persist: (args: {
    input: MetaGenInput;
    result: MetaClaudeResult;
  }) => Promise<{ contentId: string }>;
}

export interface MetaGenResult {
  status: "DONE" | "ERROR";
  contentId?: string;
  error?: string;
}

export async function generateMetaContent(
  input: MetaGenInput,
  deps: MetaDeps,
): Promise<MetaGenResult> {
  try {
    const { idea, kbContext } = await deps.loadContext(input.ideaId);
    const result = await deps.callClaude({ idea, kbContext, input });
    const { contentId } = await deps.persist({ input, result });
    return { status: "DONE", contentId };
  } catch (err) {
    return { status: "ERROR", error: err instanceof Error ? err.message : String(err) };
  }
}

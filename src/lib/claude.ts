import Anthropic from "@anthropic-ai/sdk";

export const BRAINSTORM_MODEL = "claude-opus-4-8";

let client: Anthropic | null = null;

export function getClaude(): Anthropic {
  if (!client) {
    client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  }
  return client;
}

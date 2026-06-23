import OpenAI from "openai";

export const IMAGE_MODEL = "gpt-image-1";

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!client) client = new OpenAI(); // reads OPENAI_API_KEY from env
  return client;
}

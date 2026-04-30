import OpenAI from "openai";
import { env } from "../../config/env";

let openaiClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key is missing");
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }

  return openaiClient;
}

/**
 * Generate a text-embedding-3-small vector for the given text.
 * Text is truncated to 8 000 chars to stay well within token limits.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const response = await getOpenAIClient().embeddings.create({
    model: "text-embedding-3-small",
    input: text.slice(0, 8000),
  });
  return response.data[0].embedding;
}

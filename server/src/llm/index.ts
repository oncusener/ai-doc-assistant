import { config } from "../config.js";
import { ClaudeProvider } from "./claude.js";
import { OpenAICompatProvider } from "./openaiCompat.js";
import type { ChatProvider } from "./types.js";

export function createProvider(): ChatProvider {
  if (config.llmProvider === "openai-compatible") {
    const { baseUrl, apiKey, model } = config.openaiCompat;
    return new OpenAICompatProvider(baseUrl, apiKey, model);
  }
  return new ClaudeProvider(config.claude.model, config.claude.effort);
}

export type { ChatEvent, ChatProvider, HistoryTurn, SourceRef } from "./types.js";

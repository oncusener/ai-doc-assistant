import type { RetrievedChunk } from "../retrieval.js";

/** One source shown to the user; `n` is the number used in citation markers like [2]. */
export interface SourceRef {
  n: number;
  documentId: string;
  documentName: string;
  page: number | null;
  snippet: string;
  similarity: number;
}

export type ChatEvent =
  | { type: "status"; status: "retrieving" | "thinking" | "writing" }
  | { type: "sources"; sources: SourceRef[] }
  | { type: "text"; text: string }
  | { type: "citation"; source: number; citedText: string }
  /** The model handed over mid-answer (server-side fallback); discard the partial answer. */
  | { type: "reset"; reason: string }
  | { type: "error"; message: string }
  | { type: "done"; model: string; inputTokens?: number; outputTokens?: number };

export interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AnswerRequest {
  question: string;
  history: HistoryTurn[];
  sources: RetrievedChunk[];
}

export type Emit = (event: ChatEvent) => void;

/** A provider failure whose message is safe to show to the user. */
export class ProviderError extends Error {}

export interface ChatProvider {
  readonly name: string;
  readonly model: string;
  streamAnswer(request: AnswerRequest, emit: Emit, signal: AbortSignal): Promise<void>;
}

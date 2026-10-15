import Anthropic from "@anthropic-ai/sdk";
import type { Effort } from "../config.js";
import { CitationMarkers } from "./citations.js";
import { SYSTEM_PROMPT, sourceTitle, stripCitationMarkers } from "./prompt.js";
import type { AnswerRequest, ChatProvider, Emit } from "./types.js";

/**
 * Answers with Claude. Each retrieved chunk is sent as its own document block
 * with citations enabled, so citation `document_index` maps 1:1 to our sources.
 */
export class ClaudeProvider implements ChatProvider {
  readonly name = "claude";
  private readonly client = new Anthropic();

  constructor(
    readonly model: string,
    private readonly effort: Effort,
  ) {}

  async streamAnswer({ question, history, sources }: AnswerRequest, emit: Emit, signal: AbortSignal): Promise<void> {
    const documents: Anthropic.Beta.BetaRequestDocumentBlock[] = sources.map((s) => ({
      type: "document",
      source: { type: "content", content: [{ type: "text", text: s.content }] },
      title: sourceTitle(s),
      citations: { enabled: true },
    }));

    const messages: Anthropic.Beta.BetaMessageParam[] = [
      ...history.map((turn) => ({ role: turn.role, content: stripCitationMarkers(turn.content) })),
      { role: "user", content: [...documents, { type: "text", text: question }] },
    ];

    const stream = this.client.beta.messages.stream(
      {
        model: this.model,
        max_tokens: 64000,
        // Re-run declined requests on Anthropic's recommended fallback model.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: this.effort },
        system: SYSTEM_PROMPT,
        messages,
      },
      { signal },
    );

    const markers = new CitationMarkers();
    for await (const event of stream) {
      switch (event.type) {
        case "content_block_start":
          if (event.content_block.type === "thinking") emit({ type: "status", status: "thinking" });
          else if (event.content_block.type === "text") emit({ type: "status", status: "writing" });
          else if (event.content_block.type === "fallback") {
            // Streams keep the declining model's partial output; tell the client to drop it.
            markers.reset();
            emit({ type: "reset", reason: `Answer continued by ${event.content_block.to.model}` });
          }
          break;
        case "content_block_delta":
          if (event.delta.type === "text_delta") {
            emit({ type: "text", text: event.delta.text });
          } else if (event.delta.type === "citations_delta") {
            const citation = event.delta.citation;
            if ("document_index" in citation) {
              const n = citation.document_index + 1;
              markers.add(n);
              emit({ type: "citation", source: n, citedText: citation.cited_text });
            }
          }
          break;
        case "content_block_stop": {
          const marker = markers.flush();
          if (marker) emit({ type: "text", text: marker });
          break;
        }
      }
    }

    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") {
      emit({ type: "error", message: "The model declined to answer this question." });
    } else if (final.stop_reason === "max_tokens") {
      emit({ type: "error", message: "The answer was cut off because it reached the length limit." });
    }
    emit({
      type: "done",
      model: final.model,
      inputTokens: final.usage.input_tokens,
      outputTokens: final.usage.output_tokens,
    });
  }
}

/** Human-readable message for API failures; never leaks request details. */
export function describeClaudeError(err: unknown): string | null {
  if (err instanceof Anthropic.AuthenticationError) {
    return "Claude API key is missing or invalid. Set ANTHROPIC_API_KEY in .env.";
  }
  if (err instanceof Anthropic.RateLimitError) return "Claude API rate limit reached. Try again in a moment.";
  if (err instanceof Anthropic.BadRequestError) return `Claude API rejected the request: ${err.message}`;
  if (err instanceof Anthropic.APIConnectionError) return "Could not reach the Claude API. Check your network.";
  if (err instanceof Anthropic.APIError) return `Claude API error (${err.status ?? "unknown"}).`;
  return null;
}

import { BRACKET_CITATION_RULE, numberedContext, SYSTEM_PROMPT, stripCitationMarkers } from "./prompt.js";
import { ProviderError, type AnswerRequest, type ChatProvider, type Emit } from "./types.js";

const IDLE_TIMEOUT_MS = 60_000;

interface CompletionChunk {
  model?: string;
  choices?: { delta?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
}

/**
 * Development-only provider for any OpenAI-compatible chat endpoint (a local
 * gateway, Ollama, ...). There are no native citations here, so the model is
 * asked to cite sources as [n] in the text.
 */
export class OpenAICompatProvider implements ChatProvider {
  readonly name = "openai-compatible";

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    readonly model: string,
  ) {}

  async streamAnswer({ question, history, sources }: AnswerRequest, emit: Emit, signal: AbortSignal): Promise<void> {
    const messages = [
      { role: "system", content: `${SYSTEM_PROMPT}\n${BRACKET_CITATION_RULE}` },
      ...history.map((turn) => ({ role: turn.role, content: stripCitationMarkers(turn.content) })),
      { role: "user", content: `Documents:\n\n${numberedContext(sources)}\n\nQuestion: ${question}` },
    ];

    // Free/community endpoints sometimes stall mid-stream; give up after a quiet period.
    const idle = new AbortController();
    let idleTimer = setTimeout(() => idle.abort(), IDLE_TIMEOUT_MS);
    const touch = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => idle.abort(), IDLE_TIMEOUT_MS);
    };

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({ model: this.model, messages, stream: true }),
        signal: AbortSignal.any([signal, idle.signal]),
      });
      if (response.status === 429) {
        throw new ProviderError("The model provider is rate-limiting requests. Wait a moment and try again.");
      }
      if (!response.ok || !response.body) {
        throw new ProviderError(`The model endpoint returned HTTP ${response.status}.`);
      }
      await this.readStream(response.body, emit, touch);
    } catch (err) {
      if (idle.signal.aborted && !signal.aborted) {
        emit({ type: "error", message: "The model did not respond in time. Try again." });
        emit({ type: "done", model: this.model });
        return;
      }
      throw err;
    } finally {
      clearTimeout(idleTimer);
    }
  }

  private async readStream(body: ReadableStream<Uint8Array>, emit: Emit, touch: () => void): Promise<void> {
    emit({ type: "status", status: "writing" });
    let model = this.model;
    let usage: CompletionChunk["usage"] = null;
    const decoder = new TextDecoder();
    let buffer = "";
    let gotText = false;

    for await (const part of body) {
      touch();
      buffer += decoder.decode(part, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") continue;
        let chunk: CompletionChunk;
        try {
          chunk = JSON.parse(data) as CompletionChunk;
        } catch {
          continue; // ignore keep-alives and malformed lines
        }
        if (chunk.model && chunk.model !== "keepalive") model = chunk.model;
        if (chunk.usage) usage = chunk.usage;
        const text = chunk.choices?.[0]?.delta?.content;
        if (text) {
          gotText = true;
          // Some models cite with full-width brackets (【1】); normalize to [1].
          emit({ type: "text", text: text.replace(/【/g, "[").replace(/】/g, "]") });
        }
      }
    }

    if (!gotText) emit({ type: "error", message: "The model returned an empty answer. Try again." });
    emit({
      type: "done",
      model,
      inputTokens: usage?.prompt_tokens,
      outputTokens: usage?.completion_tokens,
    });
  }
}

import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import type { Db } from "../db.js";
import { describeClaudeError } from "../llm/claude.js";
import type { ChatEvent, ChatProvider, HistoryTurn, SourceRef } from "../llm/index.js";
import { ProviderError } from "../llm/types.js";
import { retrieve } from "../retrieval.js";

interface ChatBody {
  question: string;
  history?: HistoryTurn[];
}

const bodySchema = {
  type: "object",
  required: ["question"],
  additionalProperties: false,
  properties: {
    question: { type: "string", minLength: 1, maxLength: 2000 },
    history: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        required: ["role", "content"],
        additionalProperties: false,
        properties: {
          role: { type: "string", enum: ["user", "assistant"] },
          content: { type: "string", maxLength: 8000 },
        },
      },
    },
  },
} as const;

const SNIPPET_CHARS = 280;

export function chatRoutes(app: FastifyInstance, db: Db, provider: ChatProvider): void {
  app.post<{ Body: ChatBody }>("/api/chat", { schema: { body: bodySchema } }, async (request, reply) => {
    const question = request.body.question.trim();
    const history = request.body.history ?? [];

    // Server-Sent Events over the POST response.
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });

    const controller = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) controller.abort();
    });
    const emit = (event: ChatEvent) => {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      emit({ type: "status", status: "retrieving" });
      const sources = await retrieve(db, question, config.topK);
      if (sources.length === 0) {
        emit({ type: "error", message: "No documents yet. Upload a document first." });
        return;
      }

      const refs: SourceRef[] = sources.map((s, i) => ({
        n: i + 1,
        documentId: s.documentId,
        documentName: s.documentName,
        page: s.page,
        snippet: s.content.length > SNIPPET_CHARS ? `${s.content.slice(0, SNIPPET_CHARS)}…` : s.content,
        similarity: Math.round(s.similarity * 1000) / 1000,
      }));
      emit({ type: "sources", sources: refs });

      await provider.streamAnswer({ question, history, sources }, emit, controller.signal);
    } catch (err) {
      if (controller.signal.aborted) return; // client went away
      request.log.error({ err }, "chat failed");
      const message =
        err instanceof ProviderError
          ? err.message
          : (describeClaudeError(err) ?? "Something went wrong while answering.");
      emit({ type: "error", message });
    } finally {
      res.end();
    }
  });
}

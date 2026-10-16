export interface DocumentInfo {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  pageCount: number | null;
  chunkCount: number;
  createdAt: string;
}

export interface Health {
  status: string;
  brandName: string | null;
  provider: string;
  model: string;
  embeddingModel: string;
  database: string;
  documents: number;
}

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
  | { type: "reset"; reason: string }
  | { type: "error"; message: string }
  | { type: "done"; model: string; inputTokens?: number; outputTokens?: number };

export interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string; message?: string };
    return body.error ?? body.message ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export async function getHealth(): Promise<Health> {
  const res = await fetch("/api/health");
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json() as Promise<Health>;
}

export async function listDocuments(): Promise<DocumentInfo[]> {
  const res = await fetch("/api/documents");
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json() as Promise<DocumentInfo[]>;
}

export async function uploadDocument(file: File): Promise<DocumentInfo> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/documents", { method: "POST", body: form });
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json() as Promise<DocumentInfo>;
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error(await errorMessage(res));
}

/** POST a question and yield Server-Sent Events as they arrive. */
export async function* streamChat(
  question: string,
  history: HistoryTurn[],
  signal: AbortSignal,
): AsyncGenerator<ChatEvent> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question, history }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(await errorMessage(res));

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let boundary: number;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = frame
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (data) yield JSON.parse(data) as ChatEvent;
    }
  }
}

import type { RetrievedChunk } from "../retrieval.js";

export const SYSTEM_PROMPT = `You are a document assistant for a company. Answer the user's question using only the documents attached to their message.

- If the documents do not contain the answer, say so plainly and, if useful, say which kind of document would help. Do not guess or use outside knowledge.
- Reply in the same language as the question (for example Turkish or English).
- Be concise: short paragraphs or bullet points. Quote numbers, dates, names and amounts exactly as they appear in the documents.`;

/** Extra rule for providers without native citations: cite with bracketed source numbers. */
export const BRACKET_CITATION_RULE = `- After each sentence that uses a source, cite it with its number in square brackets, for example [2]. Only cite numbers from the list provided.`;

export function sourceTitle(source: Pick<RetrievedChunk, "documentName" | "page">): string {
  return source.page === null ? source.documentName : `${source.documentName} (page ${source.page})`;
}

/** Numbered plain-text context for providers that take documents as text. */
export function numberedContext(sources: RetrievedChunk[]): string {
  return sources.map((s, i) => `[${i + 1}] ${sourceTitle(s)}\n${s.content}`).join("\n\n---\n\n");
}

/** Remove citation markers like " [2]" from stored assistant turns before replaying history. */
export function stripCitationMarkers(text: string): string {
  return text.replace(/\s?(?:\[\d+\])+(?=[\s.,;:!?)]|$)/g, "");
}

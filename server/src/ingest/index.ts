import type { Db } from "../db.js";
import { embedPassages, toPgVector } from "../embeddings.js";
import { chunkPages } from "./chunk.js";
import { detectKind, parseDocument, SUPPORTED_EXTENSIONS } from "./parse.js";

export interface DocumentRow {
  id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  page_count: number | null;
  chunk_count: number;
  created_at: string;
}

export class UnsupportedFileError extends Error {}
export class EmptyDocumentError extends Error {}

const INSERT_BATCH = 100;

export async function ingestDocument(
  db: Db,
  file: { filename: string; mimeType: string; buffer: Buffer },
): Promise<DocumentRow> {
  const kind = detectKind(file.filename);
  if (!kind) {
    throw new UnsupportedFileError(`Unsupported file type. Supported: ${SUPPORTED_EXTENSIONS.join(", ")}`);
  }

  const parsed = await parseDocument(file.buffer, kind);
  const chunks = chunkPages(parsed.pages);
  if (chunks.length === 0) {
    throw new EmptyDocumentError(
      kind === "pdf"
        ? "No text found in this PDF. Scanned PDFs need OCR before they can be indexed."
        : "No text found in this file.",
    );
  }

  // Embed before opening the transaction so a slow model never holds a write lock.
  const vectors = await embedPassages(chunks.map((c) => c.content));

  return db.transaction(async (tx) => {
    const [doc] = (
      await tx.query<DocumentRow>(
        `INSERT INTO documents (name, mime_type, size_bytes, page_count, chunk_count)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [file.filename, file.mimeType, file.buffer.length, parsed.pageCount, chunks.length],
      )
    ).rows;
    if (!doc) throw new Error("Failed to insert document");

    for (let start = 0; start < chunks.length; start += INSERT_BATCH) {
      const batch = chunks.slice(start, start + INSERT_BATCH);
      const params: unknown[] = [];
      const values = batch.map((chunk, i) => {
        const base = params.length;
        params.push(doc.id, chunk.idx, chunk.page, chunk.content, toPgVector(vectors[start + i]!));
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}::vector)`;
      });
      await tx.query(
        `INSERT INTO chunks (document_id, idx, page, content, embedding) VALUES ${values.join(", ")}`,
        params,
      );
    }
    return doc;
  });
}

import type { Queryable } from "./db.js";
import { embedQuery, toPgVector } from "./embeddings.js";

export interface RetrievedChunk {
  chunkId: number;
  documentId: string;
  documentName: string;
  page: number | null;
  content: string;
  similarity: number;
}

interface Row {
  id: string | number;
  document_id: string;
  name: string;
  page: number | null;
  content: string;
  similarity: string | number;
}

/** Nearest chunks by cosine similarity, most relevant first. */
export async function retrieve(db: Queryable, question: string, topK: number): Promise<RetrievedChunk[]> {
  const vector = toPgVector(await embedQuery(question));
  const { rows } = await db.query<Row>(
    `SELECT c.id, c.document_id, d.name, c.page, c.content,
            1 - (c.embedding <=> $1::vector) AS similarity
       FROM chunks c
       JOIN documents d ON d.id = c.document_id
      ORDER BY c.embedding <=> $1::vector
      LIMIT $2`,
    [vector, topK],
  );
  return rows.map((r) => ({
    chunkId: Number(r.id),
    documentId: r.document_id,
    documentName: r.name,
    page: r.page,
    content: r.content,
    similarity: Number(r.similarity),
  }));
}

import type { FastifyInstance } from "fastify";
import type { Db } from "../db.js";
import { EmptyDocumentError, ingestDocument, UnsupportedFileError, type DocumentRow } from "../ingest/index.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toDto(row: DocumentRow) {
  return {
    id: row.id,
    name: row.name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    pageCount: row.page_count,
    chunkCount: row.chunk_count,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export function documentRoutes(app: FastifyInstance, db: Db): void {
  app.get("/api/documents", async () => {
    const { rows } = await db.query<DocumentRow>("SELECT * FROM documents ORDER BY created_at DESC");
    return rows.map(toDto);
  });

  app.post("/api/documents", async (request, reply) => {
    const file = await request.file();
    if (!file) return reply.code(400).send({ error: "Attach a file in the 'file' field." });

    let buffer: Buffer;
    try {
      buffer = await file.toBuffer();
    } catch (err) {
      if (err instanceof app.multipartErrors.RequestFileTooLargeError) {
        return reply.code(413).send({ error: "File is too large." });
      }
      throw err;
    }

    try {
      const doc = await ingestDocument(db, { filename: file.filename, mimeType: file.mimetype, buffer });
      request.log.info({ document: doc.id, chunks: doc.chunk_count }, "document ingested");
      return reply.code(201).send(toDto(doc));
    } catch (err) {
      if (err instanceof UnsupportedFileError) return reply.code(415).send({ error: err.message });
      if (err instanceof EmptyDocumentError) return reply.code(422).send({ error: err.message });
      throw err;
    }
  });

  app.delete<{ Params: { id: string } }>("/api/documents/:id", async (request, reply) => {
    const { id } = request.params;
    if (!UUID.test(id)) return reply.code(400).send({ error: "Invalid document id." });
    const { rows } = await db.query<{ id: string }>("DELETE FROM documents WHERE id = $1 RETURNING id", [id]);
    if (rows.length === 0) return reply.code(404).send({ error: "Document not found." });
    return reply.code(204).send();
  });
}

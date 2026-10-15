import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";

export interface QueryResult<T> {
  rows: T[];
}

export interface Queryable {
  query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
}

export interface Db extends Queryable {
  readonly kind: "pglite" | "postgres";
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

function schema(dim: number): string {
  return `
    CREATE EXTENSION IF NOT EXISTS vector;

    CREATE TABLE IF NOT EXISTS documents (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name        text NOT NULL,
      mime_type   text NOT NULL,
      size_bytes  integer NOT NULL,
      page_count  integer,
      chunk_count integer NOT NULL DEFAULT 0,
      created_at  timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id          bigserial PRIMARY KEY,
      document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      idx         integer NOT NULL,
      page        integer,
      content     text NOT NULL,
      embedding   vector(${dim}) NOT NULL
    );

    CREATE INDEX IF NOT EXISTS chunks_document_idx ON chunks (document_id);
    CREATE INDEX IF NOT EXISTS chunks_embedding_idx ON chunks USING hnsw (embedding vector_cosine_ops);
  `;
}

async function openPglite(dir: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { vector } = await import("@electric-sql/pglite-pgvector");
  await fs.mkdir(dir, { recursive: true });
  const pg = await PGlite.create(dir, { extensions: { vector } });

  return {
    kind: "pglite",
    query: async <T>(sql: string, params?: unknown[]) => ({ rows: (await pg.query<T>(sql, params)).rows }),
    exec: async (sql) => {
      await pg.exec(sql);
    },
    transaction: (fn) =>
      pg.transaction((tx) =>
        fn({ query: async <T>(sql: string, params?: unknown[]) => ({ rows: (await tx.query<T>(sql, params)).rows }) }),
      ),
    close: () => pg.close(),
  };
}

async function openPostgres(url: string): Promise<Db> {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: url });

  return {
    kind: "postgres",
    query: async <T>(sql: string, params?: unknown[]) => ({ rows: (await pool.query(sql, params)).rows as T[] }),
    exec: async (sql) => {
      await pool.query(sql);
    },
    transaction: async (fn) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn({
          query: async <T>(sql: string, params?: unknown[]) => ({ rows: (await client.query(sql, params)).rows as T[] }),
        });
        await client.query("COMMIT");
        return result;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

export async function openDb(): Promise<Db> {
  const db = config.databaseUrl
    ? await openPostgres(config.databaseUrl)
    : await openPglite(path.join(config.dataDir, "pg"));
  await db.exec(schema(config.embeddingDim));
  return db;
}

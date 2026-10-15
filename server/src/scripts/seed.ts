// Index the sample documents in ./samples (skips files that are already indexed).
import fs from "node:fs/promises";
import path from "node:path";
import { config, ROOT_DIR } from "../config.js";
import { openDb } from "../db.js";
import { ingestDocument } from "../ingest/index.js";
import { detectKind } from "../ingest/parse.js";

const samplesDir = path.join(ROOT_DIR, "samples");
const db = await openDb();

try {
  const files = (await fs.readdir(samplesDir)).filter((f) => detectKind(f) !== null).sort();
  for (const filename of files) {
    const { rows } = await db.query<{ id: string }>("SELECT id FROM documents WHERE name = $1", [filename]);
    if (rows.length > 0) {
      console.log(`skip   ${filename} (already indexed)`);
      continue;
    }
    const buffer = await fs.readFile(path.join(samplesDir, filename));
    const doc = await ingestDocument(db, { filename, mimeType: "application/octet-stream", buffer });
    console.log(`added  ${filename} (${doc.chunk_count} chunks)`);
  }
  console.log(`done   database: ${config.databaseUrl ? "postgres" : "pglite"}`);
} finally {
  await db.close();
}

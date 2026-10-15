import { buildApp } from "./app.js";
import { config } from "./config.js";
import { openDb } from "./db.js";
import { warmUpEmbeddings } from "./embeddings.js";
import { createProvider } from "./llm/index.js";

const db = await openDb();
const provider = createProvider();
const app = await buildApp(db, provider);

await app.listen({ host: config.host, port: config.port });
app.log.info(
  { provider: provider.name, model: provider.model, database: db.kind, embeddingModel: config.embeddingModel },
  "ready",
);

// Load the embedding model in the background (downloads once on first run).
warmUpEmbeddings()
  .then(() => app.log.info("embedding model loaded"))
  .catch((err: unknown) => app.log.error({ err }, "could not load the embedding model"));

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    await app.close();
    await db.close();
    process.exit(0);
  });
}

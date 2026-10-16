import fs from "node:fs";
import path from "node:path";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import { config } from "./config.js";
import type { Db } from "./db.js";
import type { ChatProvider } from "./llm/index.js";
import { chatRoutes } from "./routes/chat.js";
import { documentRoutes } from "./routes/documents.js";

export async function buildApp(db: Db, provider: ChatProvider): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" } });

  await app.register(multipart, { limits: { fileSize: config.maxUploadBytes, files: 1 } });

  app.get("/api/health", async () => {
    const { rows } = await db.query<{ count: string | number }>("SELECT count(*) AS count FROM documents");
    return {
      status: "ok",
      brandName: config.brandName,
      provider: provider.name,
      model: provider.model,
      embeddingModel: config.embeddingModel,
      database: db.kind,
      documents: Number(rows[0]?.count ?? 0),
    };
  });

  documentRoutes(app, db);
  chatRoutes(app, db, provider);

  // In production the server also serves the built web app.
  if (fs.existsSync(path.join(config.webDistDir, "index.html"))) {
    await app.register(fastifyStatic, { root: config.webDistDir });
    app.setNotFoundHandler((request, reply) => {
      if (request.method === "GET" && !request.url.startsWith("/api/")) return reply.sendFile("index.html");
      return reply.code(404).send({ error: "Not found" });
    });
  }

  return app;
}

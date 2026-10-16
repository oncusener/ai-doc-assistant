import path from "node:path";
import { fileURLToPath } from "node:url";

// server/src (tsx) and server/dist (build) both sit two levels below the repo root.
const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(here, "..", "..");

export type LlmProviderName = "claude" | "openai-compatible";
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

const EFFORTS: readonly Effort[] = ["low", "medium", "high", "xhigh", "max"];

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer, got "${raw}"`);
  }
  return value;
}

function provider(raw: string | undefined): LlmProviderName {
  if (!raw || raw === "claude") return "claude";
  if (raw === "openai-compatible") return raw;
  throw new Error(`LLM_PROVIDER must be "claude" or "openai-compatible", got "${raw}"`);
}

function effort(raw: string | undefined): Effort {
  if (!raw) return "medium";
  if ((EFFORTS as readonly string[]).includes(raw)) return raw as Effort;
  throw new Error(`CLAUDE_EFFORT must be one of ${EFFORTS.join(", ")}, got "${raw}"`);
}

export const config = {
  host: process.env.HOST ?? "127.0.0.1",
  port: int("PORT", 8787),
  maxUploadBytes: int("MAX_UPLOAD_MB", 20) * 1024 * 1024,
  // Optional company name shown in the web app instead of the default title.
  brandName: process.env.BRAND_NAME?.trim() || null,

  databaseUrl: process.env.DATABASE_URL || undefined,
  dataDir: process.env.DATA_DIR ?? path.join(ROOT_DIR, "data"),

  embeddingModel: process.env.EMBEDDING_MODEL ?? "Xenova/multilingual-e5-small",
  embeddingDim: int("EMBEDDING_DIM", 384),
  modelCacheDir: process.env.MODEL_CACHE_DIR ?? path.join(ROOT_DIR, ".cache", "models"),
  topK: int("RETRIEVAL_TOP_K", 6),

  llmProvider: provider(process.env.LLM_PROVIDER),
  claude: {
    model: process.env.CLAUDE_MODEL || "claude-opus-5-5",
    effort: effort(process.env.CLAUDE_EFFORT),
  },
  openaiCompat: {
    baseUrl: (process.env.OPENAI_COMPAT_BASE_URL ?? "http://localhost:11434/v1").replace(/\/+$/, ""),
    apiKey: process.env.OPENAI_COMPAT_API_KEY ?? "",
    model: process.env.OPENAI_COMPAT_MODEL ?? "llama3.1",
  },

  webDistDir: path.join(ROOT_DIR, "web", "dist"),
} as const;

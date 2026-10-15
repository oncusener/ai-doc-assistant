import { env, pipeline } from "@huggingface/transformers";
import { config } from "./config.js";

type Extractor = Awaited<ReturnType<typeof pipeline<"feature-extraction">>>;

let extractor: Promise<Extractor> | null = null;

function getExtractor(): Promise<Extractor> {
  if (!extractor) {
    env.cacheDir = config.modelCacheDir;
    extractor = pipeline("feature-extraction", config.embeddingModel, { dtype: "q8" });
    // Let a failed download be retried on the next call instead of caching the rejection.
    extractor.catch(() => {
      extractor = null;
    });
  }
  return extractor;
}

// E5 models are trained with "query: " / "passage: " prefixes and lose accuracy without them.
const usesE5Prefixes = /(^|[/-])(multilingual-)?e5/i.test(config.embeddingModel);

async function embed(texts: string[]): Promise<number[][]> {
  const model = await getExtractor();
  const vectors: number[][] = [];
  const batchSize = 16;
  for (let i = 0; i < texts.length; i += batchSize) {
    const output = await model(texts.slice(i, i + batchSize), { pooling: "mean", normalize: true });
    vectors.push(...(output.tolist() as number[][]));
  }
  for (const v of vectors) {
    if (v.length !== config.embeddingDim) {
      throw new Error(
        `Embedding model ${config.embeddingModel} returned ${v.length} dimensions, but EMBEDDING_DIM is ${config.embeddingDim}.`,
      );
    }
  }
  return vectors;
}

export function embedPassages(texts: string[]): Promise<number[][]> {
  return embed(usesE5Prefixes ? texts.map((t) => `passage: ${t}`) : texts);
}

export async function embedQuery(text: string): Promise<number[]> {
  const [vector] = await embed([usesE5Prefixes ? `query: ${text}` : text]);
  if (!vector) throw new Error("Embedding model returned no vector");
  return vector;
}

/** Warm the model so the first upload or question does not pay the load time. */
export async function warmUpEmbeddings(): Promise<void> {
  await embedQuery("warm up");
}

export function toPgVector(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

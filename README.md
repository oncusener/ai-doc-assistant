# AI Doc Assistant

Ask questions about your company documents and get answers **with sources** — every claim links back to the exact passage it came from. Built on the Claude API with native citations, a local multilingual embedding model and PostgreSQL + pgvector.

Works in Turkish and English: upload a Turkish PDF, ask in English, and the other way round.

> Türkçe özet: Şirket dokümanlarınızı (PDF, DOCX, TXT, Markdown) yükleyin, sorularınıza dokümanlardaki kaynağını gösteren cevaplar alın. Claude API'nin yerleşik kaynak gösterme (citations) özelliğini, yerel çalışan çok dilli bir embedding modelini ve PostgreSQL + pgvector'ü kullanır.

## Features

- **Answers grounded in your documents.** The model only uses retrieved passages and says so when the answer is not in them.
- **Native citations.** Each retrieved chunk is sent to Claude as its own document block with citations enabled, so every cited claim maps to an exact chunk, file and PDF page.
- **Streaming UI.** Answers stream token by token over Server-Sent Events; citation chips expand to show the quoted text.
- **Multilingual retrieval, fully local.** `multilingual-e5-small` runs on your machine — no embedding API, no per-document cost.
- **Zero-setup storage.** An embedded Postgres (PGlite + pgvector) by default; point `DATABASE_URL` at any Postgres with pgvector for production.
- **Safe failure modes.** Server-side refusal fallback on Claude, idle timeouts on the dev provider, scanned-PDF detection, upload size limits.

## How it works

```
upload ─▶ parse (PDF per page / DOCX / text) ─▶ chunk (~1200 chars, overlap, never spans pages)
       ─▶ embed locally (multilingual-e5-small, 384-d) ─▶ PostgreSQL + pgvector (HNSW, cosine)

question ─▶ embed ─▶ top-k nearest chunks ─▶ Claude (one document block per chunk, citations on)
         ─▶ SSE stream: sources → text → citation markers → done
```

| Layer | Tech |
|---|---|
| API | Node.js 22, TypeScript, Fastify 5 |
| LLM | Claude API (`@anthropic-ai/sdk`), default `claude-opus-5-5`, adaptive thinking, server-side fallback |
| Retrieval | `@huggingface/transformers` (ONNX, runs locally), pgvector HNSW index |
| Storage | PGlite (embedded) or PostgreSQL 17 + pgvector |
| Web | React 19, Vite, Tailwind CSS 4, `react-markdown` |
| Ops | Docker, docker-compose, GitHub Actions |

## Quick start

Requirements: Node.js 22+.

```bash
npm install
cp .env.example .env        # then set ANTHROPIC_API_KEY
npm run seed                # optional: index the sample documents in ./samples
npm run dev                 # API on :8787, web app on http://localhost:5173
```

The first run downloads the embedding model once (~120 MB) into `.cache/models`.

### Without a Claude API key

For local development you can point the app at any OpenAI-compatible endpoint (for example a local gateway or Ollama):

```bash
LLM_PROVIDER=openai-compatible OPENAI_COMPAT_BASE_URL=http://localhost:11434/v1 OPENAI_COMPAT_MODEL=llama3.1 npm run dev
```

This mode has no native citations; the model is asked to cite sources as `[n]` instead.

### Production

```bash
npm run build && npm start   # serves the API and the built web app on :8787
```

or with Docker (app + Postgres with pgvector):

```bash
docker compose up --build
```

## Configuration

All settings live in `.env` (see [`.env.example`](.env.example)).

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Claude API key |
| `CLAUDE_MODEL` | `claude-opus-5-5` | Claude model |
| `CLAUDE_EFFORT` | `medium` | `low` … `max`; trades answer depth for cost and latency |
| `LLM_PROVIDER` | `claude` | `claude` or `openai-compatible` |
| `DATABASE_URL` | empty | Empty = embedded PGlite in `./data/pg` |
| `EMBEDDING_MODEL` | `Xenova/multilingual-e5-small` | Any feature-extraction model; set `EMBEDDING_DIM` to match |
| `RETRIEVAL_TOP_K` | `6` | Chunks sent with each question |
| `MAX_UPLOAD_MB` | `20` | Upload size limit |
| `BRAND_NAME` | empty | Company name shown in the web app instead of the default title |

## API

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Provider, model, database, document count |
| `GET` | `/api/documents` | List indexed documents |
| `POST` | `/api/documents` | Upload (`multipart/form-data`, field `file`) |
| `DELETE` | `/api/documents/:id` | Remove a document and its chunks |
| `POST` | `/api/chat` | `{ question, history? }` → SSE stream of `status`, `sources`, `text`, `citation`, `reset`, `error`, `done` events |

## Development

```bash
npm test          # unit tests (chunking, citation markers, prompt helpers)
npm run typecheck
```

## Limitations

- Scanned PDFs need OCR before indexing; the app rejects PDFs with no text layer.
- No authentication yet — run it on a private network or behind your own auth proxy.
- One shared document collection; per-team workspaces are a natural next step.

## License

MIT — the sample documents in `samples/` describe fictional companies.

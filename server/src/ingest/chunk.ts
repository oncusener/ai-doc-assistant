import type { ParsedPage } from "./parse.js";

export interface Chunk {
  idx: number;
  page: number | null;
  content: string;
}

export interface ChunkOptions {
  /** Target upper bound for a chunk, overlap excluded. */
  maxChars?: number;
  /** Characters carried over from the previous chunk on the same page. */
  overlapChars?: number;
}

export function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Split text into units no longer than maxChars: paragraphs, then sentences, then hard cuts. */
function units(text: string, maxChars: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split(/\n\s*\n/)) {
    const p = paragraph.trim();
    if (!p) continue;
    if (p.length <= maxChars) {
      out.push(p);
      continue;
    }
    for (const sentence of p.split(/(?<=[.!?…])\s+/)) {
      if (sentence.length <= maxChars) {
        out.push(sentence);
        continue;
      }
      for (let i = 0; i < sentence.length; i += maxChars) {
        out.push(sentence.slice(i, i + maxChars));
      }
    }
  }
  return out;
}

/** The last ~n characters of text, starting at a word boundary. */
function tail(text: string, n: number): string {
  if (n <= 0 || text.length <= n) return n <= 0 ? "" : text;
  const slice = text.slice(text.length - n);
  const space = slice.indexOf(" ");
  return space === -1 ? slice : slice.slice(space + 1);
}

/**
 * Pack page text into overlapping chunks. Chunks never span pages, so every
 * chunk keeps an exact page number for citations.
 */
export function chunkPages(pages: ParsedPage[], options: ChunkOptions = {}): Chunk[] {
  const maxChars = options.maxChars ?? 1200;
  const overlapChars = Math.min(options.overlapChars ?? 200, Math.floor(maxChars / 2));
  const chunks: Chunk[] = [];

  for (const { page, text } of pages) {
    let current = "";
    let fresh = ""; // text added since the last emitted chunk (excludes carried-over overlap)

    const emit = () => {
      if (fresh.trim()) chunks.push({ idx: chunks.length, page, content: current.trim() });
      current = tail(current, overlapChars);
      fresh = "";
    };

    for (const unit of units(normalizeText(text), maxChars)) {
      const separator = current ? "\n\n" : "";
      if (fresh && current.length + separator.length + unit.length > maxChars + overlapChars) {
        emit();
      }
      current += (current ? "\n\n" : "") + unit;
      fresh += unit;
    }
    emit();
  }

  return chunks;
}

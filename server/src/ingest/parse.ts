import path from "node:path";

export type DocumentKind = "pdf" | "docx" | "text";

export interface ParsedPage {
  /** 1-based page number for PDFs, null for formats without pages. */
  page: number | null;
  text: string;
}

export interface ParsedDocument {
  pages: ParsedPage[];
  pageCount: number | null;
}

const EXTENSIONS: Record<string, DocumentKind> = {
  ".pdf": "pdf",
  ".docx": "docx",
  ".txt": "text",
  ".md": "text",
  ".markdown": "text",
  ".csv": "text",
};

export const SUPPORTED_EXTENSIONS = Object.keys(EXTENSIONS);

export function detectKind(filename: string): DocumentKind | null {
  return EXTENSIONS[path.extname(filename).toLowerCase()] ?? null;
}

export async function parseDocument(buffer: Buffer, kind: DocumentKind): Promise<ParsedDocument> {
  switch (kind) {
    case "pdf": {
      const { extractText } = await import("unpdf");
      const { totalPages, text } = await extractText(new Uint8Array(buffer), { mergePages: false });
      return { pages: text.map((t, i) => ({ page: i + 1, text: t })), pageCount: totalPages };
    }
    case "docx": {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.extractRawText({ buffer });
      return { pages: [{ page: null, text: value }], pageCount: null };
    }
    case "text":
      return { pages: [{ page: null, text: buffer.toString("utf8") }], pageCount: null };
  }
}

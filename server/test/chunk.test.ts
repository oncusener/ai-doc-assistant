import { describe, expect, it } from "vitest";
import { chunkPages, normalizeText } from "../src/ingest/chunk.js";

const paragraph = (words: number, word = "kelime") => Array.from({ length: words }, () => word).join(" ") + ".";

describe("normalizeText", () => {
  it("collapses whitespace but keeps paragraph breaks", () => {
    expect(normalizeText("  Merhaba \t dünya\r\n\r\n\r\n\nİkinci   paragraf  ")).toBe("Merhaba dünya\n\nİkinci paragraf");
  });
});

describe("chunkPages", () => {
  it("returns no chunks for empty or whitespace-only text", () => {
    expect(chunkPages([{ page: 1, text: "   \n\n  " }])).toEqual([]);
  });

  it("keeps a short document as one chunk", () => {
    const chunks = chunkPages([{ page: null, text: "Yıllık izin 14 gündür.\n\nİzin talebi İK'ya yapılır." }]);
    expect(chunks).toEqual([{ idx: 0, page: null, content: "Yıllık izin 14 gündür.\n\nİzin talebi İK'ya yapılır." }]);
  });

  it("respects the size limit and overlaps consecutive chunks", () => {
    const text = Array.from({ length: 12 }, (_, i) => paragraph(40, `p${i}`)).join("\n\n");
    const chunks = chunkPages([{ page: 3, text }], { maxChars: 600, overlapChars: 100 });

    expect(chunks.length).toBeGreaterThan(2);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(700);
      expect(chunk.page).toBe(3);
    }
    for (let i = 1; i < chunks.length; i++) {
      const prevTail = chunks[i - 1]!.content.slice(-40);
      expect(chunks[i]!.content).toContain(prevTail.split(" ").slice(1).join(" "));
    }
  });

  it("never spans pages and numbers chunks across the whole document", () => {
    const chunks = chunkPages([
      { page: 1, text: "Birinci sayfa içeriği." },
      { page: 2, text: "İkinci sayfa içeriği." },
    ]);
    expect(chunks.map((c) => [c.idx, c.page])).toEqual([
      [0, 1],
      [1, 2],
    ]);
  });

  it("splits a single oversized paragraph by sentences, then by hard cuts", () => {
    const sentences = Array.from({ length: 30 }, (_, i) => `Bu ${i}. cümledir ve biraz uzundur.`).join(" ");
    const noBreaks = "x".repeat(2500);
    const chunks = chunkPages([{ page: null, text: `${sentences}\n\n${noBreaks}` }], { maxChars: 500, overlapChars: 50 });
    expect(chunks.length).toBeGreaterThan(3);
    expect(Math.max(...chunks.map((c) => c.content.length))).toBeLessThanOrEqual(550 + 2);
  });
});

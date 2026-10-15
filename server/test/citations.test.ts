import { describe, expect, it } from "vitest";
import { CitationMarkers } from "../src/llm/citations.js";
import { numberedContext, sourceTitle, stripCitationMarkers } from "../src/llm/prompt.js";

describe("CitationMarkers", () => {
  it("emits deduplicated markers once per closed block", () => {
    const markers = new CitationMarkers();
    markers.add(2);
    markers.add(1);
    markers.add(2);
    expect(markers.flush()).toBe(" [2][1]");
    expect(markers.flush()).toBe("");
  });

  it("drops pending citations on reset (model fallback)", () => {
    const markers = new CitationMarkers();
    markers.add(3);
    markers.reset();
    expect(markers.flush()).toBe("");
  });
});

describe("prompt helpers", () => {
  it("strips citation markers before replaying history", () => {
    expect(stripCitationMarkers("Yıllık izin 14 gündür [1][2]. Talep İK'ya yapılır [3]")).toBe(
      "Yıllık izin 14 gündür. Talep İK'ya yapılır",
    );
  });

  it("keeps bracketed text that is not a citation", () => {
    expect(stripCitationMarkers("Use the [beta] flag")).toBe("Use the [beta] flag");
  });

  it("titles sources with page numbers when known", () => {
    expect(sourceTitle({ documentName: "policy.pdf", page: 4 })).toBe("policy.pdf (page 4)");
    expect(sourceTitle({ documentName: "faq.md", page: null })).toBe("faq.md");
  });

  it("numbers context blocks from 1", () => {
    const text = numberedContext([
      { chunkId: 1, documentId: "a", documentName: "a.md", page: null, content: "Alpha", similarity: 0.9 },
      { chunkId: 2, documentId: "b", documentName: "b.pdf", page: 2, content: "Beta", similarity: 0.8 },
    ]);
    expect(text).toBe("[1] a.md\nAlpha\n\n---\n\n[2] b.pdf (page 2)\nBeta");
  });
});

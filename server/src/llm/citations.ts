/**
 * Collects citations that arrive while a text block streams and turns them into
 * markers like " [1][3]" emitted once the block closes, so each marker sits right
 * after the claim it supports.
 */
export class CitationMarkers {
  private pending: number[] = [];

  add(sourceNumber: number): void {
    if (!this.pending.includes(sourceNumber)) this.pending.push(sourceNumber);
  }

  /** Marker text for the block that just closed ("" if it had no citations). */
  flush(): string {
    if (this.pending.length === 0) return "";
    const marker = " " + this.pending.map((n) => `[${n}]`).join("");
    this.pending = [];
    return marker;
  }

  reset(): void {
    this.pending = [];
  }
}

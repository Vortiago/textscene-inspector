/**
 * Rows of floats, one per light, volume, probe or decal, that each pack rewrites in place and
 * compares as it writes, so an unchanged pack uploads nothing.
 */

/** Rows of `width` texels, `count` of them, then unused space. */
export interface PackedRows {
  readonly data: Float32Array;
  readonly count: number;
}

export class RowBuffer implements PackedRows {
  /** The rows, `count` of them, then unused space. */
  data: Float32Array;
  count = 0;
  /** Written by `append`, during a pack. Cleared by `begin`. */
  private appended = 0;
  private hasChanged = false;

  constructor(private readonly rowLength: number) {
    this.data = new Float32Array(rowLength);
  }

  /** Starts a pack: the rows appended next replace the ones held. */
  protected begin(): void {
    this.appended = 0;
    this.hasChanged = false;
  }

  protected append(row: Float32Array): void {
    this.reserve(this.appended + 1);
    const start = this.appended * this.rowLength;
    for (let i = 0; i < this.rowLength; i++) {
      if (this.data[start + i] !== row[i]) this.hasChanged = true;
      this.data[start + i] = row[i]!;
    }
    this.appended++;
  }

  /** Ends a pack, and answers whether any row changed. */
  protected finish(): boolean {
    const hasChanged = this.hasChanged || this.appended !== this.count;
    this.count = this.appended;
    return hasChanged;
  }

  private reserve(rows: number): void {
    if (this.data.length >= rows * this.rowLength) return;
    const grown = new Float32Array(rows * 2 * this.rowLength);
    grown.set(this.data);
    this.data = grown;
  }
}

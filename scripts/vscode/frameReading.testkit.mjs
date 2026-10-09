/** A fake Playwright frame for the readback tests. */

/** A frame whose successive `evaluate` calls answer `reads` in turn, the last one repeating. */
export function frameReading(reads) {
  let index = 0;
  return { evaluate: async () => reads[Math.min(index++, reads.length - 1)] };
}

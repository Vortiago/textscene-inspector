/**
 * A crafted value that makes a `[^)]*` call-body search quadratic, and the ceiling a linear reader of it stays under.
 */

/**
 * Openers in {@link unclosedCalls}. An unanchored `"cells":PackedInt32Array\(([^)]*)\)` search over this many takes
 * about 4 s, as each opener rescans to the end. A linear reader takes a few milliseconds.
 */
export const CRAFTED_OPENER_COUNT = 16000;

/**
 * A quarter of the quadratic search's 4 s, and hundreds of times a linear reader's cost, so a loaded CI machine
 * still passes a linear reader.
 */
export const LINEAR_SCAN_CEILING_MS = 1000;

/**
 * A Dictionary of `count` copies of `opener`, closed by `count + 1` braces and holding no `)` or `]`. For an opener
 * with one open delimiter, a balance count that takes any closer for any opener reads it as one complete value.
 */
export function unclosedCalls(opener: string, count = CRAFTED_OPENER_COUNT): string {
  return `{${opener.repeat(count)}${'}'.repeat(count + 1)}`;
}

/** Milliseconds `read` takes on `value`. */
export function msToRead(read: (value: string) => unknown, value: string): number {
  const start = performance.now();
  read(value);
  return performance.now() - start;
}

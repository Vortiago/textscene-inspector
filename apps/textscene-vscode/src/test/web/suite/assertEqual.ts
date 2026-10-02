/**
 * Deep equality for the web suite. Node's `assert` is a builtin, which a browser worker
 * lacks, and plain JSON values are all the suite compares.
 */
export function assertEqual(found: unknown, expected: unknown, what: string): void {
  if (JSON.stringify(found) !== JSON.stringify(expected)) {
    throw new Error(`expected ${what} to be ${JSON.stringify(expected)}, found ${JSON.stringify(found)}`);
  }
}

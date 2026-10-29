/**
 * Whether two plain data values hold the same content: numbers, strings, booleans, null, and arrays
 * and objects of them. A NaN equals a NaN, so a value with one in it can still be found unchanged.
 *
 * @canonical Whether two plain data values hold the same content
 */
export function sameData(a: unknown, b: unknown): boolean {
  if (a === b || (a !== a && b !== b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysOfA = Object.keys(a);
  if (keysOfA.length !== Object.keys(b).length) return false;
  return keysOfA.every(
    (key) => key in b && sameData((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
  );
}

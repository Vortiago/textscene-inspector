/**
 * Whether two plain data values hold the same content: numbers, strings, booleans, null, typed
 * arrays, and arrays and objects of them. A NaN equals a NaN, so a value with one in it can still
 * be found unchanged.
 *
 * @canonical Whether two plain data values hold the same content
 */
export function sameData(a: unknown, b: unknown): boolean {
  if (a === b || (a !== a && b !== b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (ArrayBuffer.isView(a) || ArrayBuffer.isView(b)) return sameTypedArray(a, b);
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysOfA = Object.keys(a);
  if (keysOfA.length !== Object.keys(b).length) return false;
  return keysOfA.every(
    (key) => key in b && sameData((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
  );
}

/** Indexed, not through `Object.keys`: a skin holds four weights a vertex, and a key array each would cost more. */
function sameTypedArray(a: object, b: object): boolean {
  if (a.constructor !== b.constructor) return false;
  const left = a as ArrayLike<number>;
  const right = b as ArrayLike<number>;
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i] && (left[i] === left[i] || right[i] === right[i])) return false;
  }
  return true;
}

/**
 * Whether two lists hold the same elements in the same order, each pair compared with `same`,
 * which is `===` unless given.
 */
export function sameElements<T>(
  a: readonly T[],
  b: readonly T[],
  same: (x: T, y: T) => boolean = (x, y) => x === y
): boolean {
  return a.length === b.length && a.every((element, index) => same(element, b[index]!));
}

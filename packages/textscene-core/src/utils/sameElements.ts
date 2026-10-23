/** Whether two lists hold the same elements, compared with `===`, in the same order. */
export function sameElements<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((element, index) => element === b[index]);
}

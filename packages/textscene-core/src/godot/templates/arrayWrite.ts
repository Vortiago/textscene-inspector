/** Appends every element of `source` to `target`, in a loop: V8 overflows on about 10^5 spread arguments. */
export function appendAll<T>(target: T[], source: readonly T[]): void {
  for (const element of source) target.push(element);
}

/** Makes `target` hold the elements of `source`. */
export function replaceAll<T>(target: T[], source: readonly T[]): void {
  target.length = 0;
  appendAll(target, source);
}

/** Overwrites `target` from `start` with the elements of `source`. */
export function writeAt<T>(target: T[], start: number, source: readonly T[]): void {
  source.forEach((element, index) => (target[start + index] = element));
}

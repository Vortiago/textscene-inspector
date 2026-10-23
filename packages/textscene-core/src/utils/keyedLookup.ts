/**
 * The index of the entry of a table that carries a key, found through an index built once for each
 * table, so a table with many lookups reads each entry once instead of a scan for each lookup.
 */

import { perObject } from './perObject.js';

type Claim<K> = (indexOf: Map<K, number>, key: K, index: number) => void;

/**
 * A lookup over tables that never change once looked up: the parser freezes the tables it hands
 * out. Each index is keyed on its table's identity, so a changed table would read the old entries.
 */
function keyedLookup<T, K>(
  keyOf: (entry: T) => K,
  claim: Claim<K>
): (table: readonly T[], key: K) => number | undefined {
  const indexOf = perObject((table: readonly T[]) => {
    const byKey = new Map<K, number>();
    table.forEach((entry, index) => claim(byKey, keyOf(entry), index));
    return byKey;
  });
  return (table, key) => indexOf(table).get(key);
}

/** The index of the first entry of a table whose key is `key`, or undefined where none is. */
export function firstWith<T, K>(keyOf: (entry: T) => K): (table: readonly T[], key: K) => number | undefined {
  return keyedLookup(keyOf, (indexOf, key, index) => {
    if (!indexOf.has(key)) indexOf.set(key, index);
  });
}

/** The index of the last entry of a table whose key is `key`, or undefined where none is. */
export function lastWith<T, K>(keyOf: (entry: T) => K): (table: readonly T[], key: K) => number | undefined {
  return keyedLookup(keyOf, (indexOf, key, index) => indexOf.set(key, index));
}

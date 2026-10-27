/**
 * The entry of a table that carries a key, found through an index built once for each table, so a
 * table with many lookups reads each entry once instead of a scan for each lookup.
 */

import { perObject } from './perObject.js';

/**
 * A lookup over tables that never change once looked up: the parser freezes the tables it hands
 * out. Each index is keyed on its table's identity, so a changed table would read the old entries.
 * `keepsFirst` picks which of the entries sharing a key the index holds.
 */
function keyedLookup<T, K, V>(
  keyOf: (entry: T) => K,
  valueOf: (entry: T, index: number) => V,
  keepsFirst: boolean
): (table: readonly T[], key: K) => V | undefined {
  const indexOf = perObject((table: readonly T[]) => {
    const byKey = new Map<K, V>();
    table.forEach((entry, index) => {
      const key = keyOf(entry);
      if (!keepsFirst || !byKey.has(key)) byKey.set(key, valueOf(entry, index));
    });
    return byKey;
  });
  return (table, key) => indexOf(table).get(key);
}

const entryItself = <T>(entry: T): T => entry;
const indexItself = <T>(_entry: T, index: number): number => index;

/**
 * The first entry of a table whose key is `key`, or undefined where none is.
 *
 * @canonical An entry by its key in a frozen table
 *   They build one Map for each table.
 */
export function firstWith<T, K>(keyOf: (entry: T) => K): (table: readonly T[], key: K) => T | undefined {
  return keyedLookup(keyOf, entryItself, true);
}

/**
 * The last entry of a table whose key is `key`, or undefined where none is.
 *
 * @canonical An entry by its key in a frozen table
 */
export function lastWith<T, K>(keyOf: (entry: T) => K): (table: readonly T[], key: K) => T | undefined {
  return keyedLookup(keyOf, entryItself, false);
}

/**
 * The index of the first entry of a table whose key is `key`, or undefined where none is.
 *
 * @canonical An entry by its key in a frozen table
 */
export function firstIndexWith<T, K>(
  keyOf: (entry: T) => K
): (table: readonly T[], key: K) => number | undefined {
  return keyedLookup(keyOf, indexItself, true);
}

/**
 * The entry of a table that carries a key, found through an index built once for each table, so a
 * table with many lookups reads each entry once instead of a scan for each lookup.
 */

import { perObject } from './perObject.js';

/** An entry of a table and its index in it. */
export interface IndexedEntry<T> {
  readonly index: number;
  readonly entry: T;
}

/** The entries of a table by key, and how many of its leading entries they cover. */
interface KeyIndexes<T, K> {
  readonly byKey: Map<K, IndexedEntry<T>>;
  covered: number;
}

type Claim<T, K> = (byKey: Map<K, IndexedEntry<T>>, key: K, found: IndexedEntry<T>) => void;

/**
 * A lookup over tables that are only appended to, such as one its file is still filling: the
 * indexes extend over the new tail, and start again after the table is cut short. A caller that
 * replaces an entry in place reads the old one.
 */
function indexBy<T, K>(
  keyOf: (entry: T) => K,
  claim: Claim<T, K>
): (table: readonly T[], key: K) => IndexedEntry<T> | undefined {
  const indexesOf = perObject((_table: readonly T[]): KeyIndexes<T, K> => ({ byKey: new Map(), covered: 0 }));
  return (table, key) => {
    const indexes = indexesOf(table);
    if (indexes.covered > table.length) {
      indexes.byKey.clear();
      indexes.covered = 0;
    }
    for (; indexes.covered < table.length; indexes.covered++) {
      const entry = table[indexes.covered]!;
      claim(indexes.byKey, keyOf(entry), { index: indexes.covered, entry });
    }
    return indexes.byKey.get(key);
  };
}

/** The first entry of a table whose key is `key`, or undefined where none is. */
export function firstWith<T, K>(
  keyOf: (entry: T) => K
): (table: readonly T[], key: K) => IndexedEntry<T> | undefined {
  return indexBy(keyOf, (byKey, key, found) => {
    if (!byKey.has(key)) byKey.set(key, found);
  });
}

/** The last entry of a table whose key is `key`, or undefined where none is. */
export function lastWith<T, K>(
  keyOf: (entry: T) => K
): (table: readonly T[], key: K) => IndexedEntry<T> | undefined {
  return indexBy(keyOf, (byKey, key, found) => byKey.set(key, found));
}

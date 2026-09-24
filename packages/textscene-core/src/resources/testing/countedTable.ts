/** A resource table that counts reads of its entries, so a test tells an id lookup from a scan. */
export interface CountedTable<T> {
  table: T[];
  /** How many times an entry has been read by index since the table was made. */
  entryReads: () => number;
}

const INDEX_KEY = /^\d+$/;

export function countedTable<T>(entries: readonly T[]): CountedTable<T> {
  let reads = 0;
  const table = new Proxy([...entries], {
    get(target, key, receiver) {
      if (typeof key === 'string' && INDEX_KEY.test(key)) reads += 1;
      return Reflect.get(target, key, receiver) as unknown;
    },
  });
  return { table, entryReads: () => reads };
}

/** Bounded-concurrency fan-out, shared by the resolver and the catalog build. */

/** Run `task` over `items` with a bounded number in flight. */
export async function mapPool(items, concurrency, task) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await task(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

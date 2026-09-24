/** The docs/source chips, and what happens to a link the network could not verify. */

import { docsUrl, fetchSourceIndex, makeResolver, mapPool } from '../godotLinks.mjs';

/**
 * Attaches `docs` and `source` to every entry. On a network failure the previous
 * run's source is carried forward, so a flaky network never strips the catalog.
 */
export async function attachLinks(entries, previousByName) {
  const carryForward = (why) => {
    const noPrevious = entries.filter((e) => !previousByName.get(e.name)?.source).map((e) => e.name);
    console.error(`[catalog] source resolution skipped (${why}); keeping previous values.`);
    if (noPrevious.length) {
      console.error(
        `[catalog] ${noPrevious.length} class(es) have no previous link either and ship sourceless:\n  ${noPrevious.join('\n  ')}`
      );
    }
    return entries.map((e) => {
      const prev = previousByName.get(e.name);
      return { ...e, docs: docsUrl(e.name), ...(prev?.source ? { source: prev.source } : {}) };
    });
  };

  let index;
  try {
    index = await fetchSourceIndex();
  } catch (err) {
    return carryForward(err.message);
  }

  const resolve = makeResolver(index);
  const unresolved = [];
  const carried = [];
  const linked = await mapPool(entries, 8, async (e) => {
    let source;
    try {
      source = await resolve(e.name, e.chain ?? []);
    } catch {
      source = null;
    }
    if (!source) {
      // The previous value survives a transient miss. It is reported, since an
      // upstream header rename also lands here and would ship a 404.
      source = previousByName.get(e.name)?.source ?? null;
      if (source) carried.push(e.name);
      else unresolved.push(e.name);
    }
    // `chain` is persisted: without it `--links-only` resolves only direct
    // filename hits.
    return { ...e, docs: docsUrl(e.name), ...(source ? { source } : {}) };
  });

  if (carried.length) {
    console.error(
      `[catalog] ${carried.length} class(es) FAILED verification and kept their previous source link — re-check these, the header may have been renamed upstream:\n  ${carried.join('\n  ')}`
    );
  }
  if (unresolved.length) {
    console.error(
      `[catalog] ${unresolved.length} class(es) have NO verified source file and will ship without one:\n  ${unresolved.join('\n  ')}`
    );
  }
  return linked;
}

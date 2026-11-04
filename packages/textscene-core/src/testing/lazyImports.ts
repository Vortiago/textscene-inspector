/**
 * Test-only: the imports a lazy chunk starts, through `React.lazy` or `memoisedImport`, so a test
 * file waits for them before its module runner closes. An import still loading then asks the closed runner for its next module, and the
 * error React logs for it outlives the file and fails the run.
 */

import type { lazy } from 'react';
import type { memoisedImport } from '../resources/memoisedImport';

/** Below Vitest's 10 s hook timeout, so a stuck import fails with this module's message. */
const SETTLE_TIMEOUT_MS = 8000;

/** Written only by `tracked`. An entry clears when its import lands or fails. */
const loadingImports = new Set<Promise<unknown>>();

/** Tracks `load`'s import until it lands or fails, and gives it back unchanged. */
function tracked<T>(load: () => Promise<T>): Promise<T> {
  const loading = load();
  const clear = () => loadingImports.delete(loading);
  loadingImports.add(loading);
  loading.then(clear, clear);
  return loading;
}

/** `reactLazy`, with each import it starts tracked until it lands or fails. */
export function trackedLazy(reactLazy: typeof lazy): typeof lazy {
  return (load) => reactLazy(() => tracked(load));
}

/** `memoise`, with each import it starts tracked until it lands or fails. */
export function trackedMemoisedImport(memoise: typeof memoisedImport): typeof memoisedImport {
  return (load) => memoise(() => tracked(load));
}

/**
 * Waits until every tracked import has landed or failed. Throws when one still loads after
 * {@link SETTLE_TIMEOUT_MS}, as a test that holds a chunk back must land it before the file ends.
 *
 * `settlePendingLoads` waits only for the chunks a loader counts.
 *
 * @canonical In tests, every lazy chunk import a test file started
 */
export async function settleLazyImports(): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<'timed out'>((resolve) => {
    timer = setTimeout(() => resolve('timed out'), SETTLE_TIMEOUT_MS);
  });
  try {
    // A loop, not one wait: a chunk that lands can render a lazy child whose import starts later.
    while (loadingImports.size > 0) {
      const outcome = await Promise.race([Promise.allSettled(loadingImports), timedOut]);
      if (outcome === 'timed out') {
        throw new Error(
          `expected every lazy chunk import to land within ${SETTLE_TIMEOUT_MS} ms, found ${loadingImports.size} still loading`
        );
      }
    }
  } finally {
    clearTimeout(timer);
  }
}

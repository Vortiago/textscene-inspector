/**
 * Test-only: the imports `React.lazy` starts, so a test file waits for them before its module
 * runner closes. An import still loading then asks the closed runner for its next module, and the
 * error React logs for it outlives the file and fails the run.
 */

import type { lazy } from 'react';

/** Below Vitest's 10 s hook timeout, so a stuck import fails with this module's message. */
const SETTLE_TIMEOUT_MS = 8000;

/** Written only by `trackedLazy`'s loads. An entry clears when its import lands or fails. */
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

/**
 * Waits until every tracked import has landed or failed. Throws when one still loads after
 * {@link SETTLE_TIMEOUT_MS}, as a test that holds a chunk back must land it before the file ends.
 *
 * `settlePendingLoads` waits only for the chunks a loader counts.
 *
 * @canonical In tests, every React.lazy import a test file started
 */
export async function settleLazyImports(): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<'timed out'>((resolve) => {
    timer = setTimeout(() => resolve('timed out'), SETTLE_TIMEOUT_MS);
  });
  const outcome = await Promise.race([Promise.allSettled(loadingImports), timedOut]);
  clearTimeout(timer);
  if (outcome === 'timed out') {
    throw new Error(
      `expected every React.lazy import to land within ${SETTLE_TIMEOUT_MS} ms, found ${loadingImports.size} still loading`
    );
  }
}

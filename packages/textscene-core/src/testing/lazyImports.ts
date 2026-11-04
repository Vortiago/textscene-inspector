/**
 * Test-only: the imports `React.lazy` starts, so a test file waits for them before its module
 * runner closes. An import still loading then asks the closed runner for its next module, and the
 * error React logs for it outlives the file and fails the run.
 */

import type { lazy } from 'react';

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

/** Waits until every tracked import has landed or failed. */
export async function settleLazyImports(): Promise<void> {
  await Promise.allSettled(loadingImports);
}

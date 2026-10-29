/**
 * A code chunk a component loads on demand, off the webview's initial-paint path: one import shared
 * by every caller, read through effect and state. Not Suspense: `<Canvas>` mounts its own reconciler
 * root, so a suspended node would blank its siblings while it waited.
 */

import { useEffect, useState } from 'react';
import { usePendingWhile } from './usePendingWhile';

/**
 * `load` once, on the first call, shared by every later call. A failed import stays failed.
 *
 * @canonical A dynamic import loaded once
 */
export function memoisedImport<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => (pending ??= load());
}

/**
 * The module `load` gives, or null before it lands. The caller counts as one pending load until
 * then, so a capture waits for the chunk. A module that fails to load reads null for good, and the
 * caller draws as it does before the load.
 *
 * @canonical A component's lazily loaded module
 */
export function useLazyModule<T>(load: () => Promise<T>): T | null {
  const [module, setModule] = useState<T | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    load().then(
      (loaded) => {
        if (!cancelled) setModule(() => loaded);
      },
      () => {
        if (!cancelled) setLoadFailed(true);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [load]);
  usePendingWhile(module === null && !loadFailed);
  return module;
}

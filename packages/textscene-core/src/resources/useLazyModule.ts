/**
 * A code chunk a component loads on demand, off the webview's initial-paint path: one import shared
 * by every caller, read through effect and state. Not Suspense: `<Canvas>` mounts its own reconciler
 * root, so a suspended node would blank its siblings while it waited.
 */

import { useEffect, useState } from 'react';
import { usePendingWhile } from './usePendingWhile';
import type { LazyImport } from './memoisedImport';

/**
 * The module `load` gives, or null before it lands. The caller counts as one pending load until
 * then, so a capture waits for the chunk. A module that fails to load reads null for good, and the
 * caller draws as it does before the load. An import that has already landed or failed reads so
 * from the first render.
 *
 * @canonical A component's lazily loaded module
 */
export function useLazyModule<T>(load: LazyImport<T>): T | null {
  const [state, setState] = useState(load.state);
  const isLoading = state === 'loading';
  useEffect(() => {
    if (!isLoading) return undefined;
    let cancelled = false;
    load().then(
      (module) => {
        if (!cancelled) setState({ module });
      },
      () => {
        if (!cancelled) setState('failed');
      }
    );
    return () => {
      cancelled = true;
    };
  }, [load, isLoading]);
  usePendingWhile(isLoading);
  return typeof state === 'object' ? state.module : null;
}

import { useEffect, useState } from 'react';
import { usePendingWhile } from './usePendingWhile';
import type { LazyImport, LazyState } from './memoisedImport';

// Not Suspense: `<Canvas>` mounts its own reconciler root, so a suspended node would blank its siblings.
/**
 * The module `load` gives, or null before it lands. The caller counts as one pending load until
 * then, so a capture waits for the chunk. A module that fails to load reads null for good, and the
 * caller draws as it does before the load. An import that has already landed or failed reads so
 * from the first render.
 *
 * @canonical A component's lazily loaded module
 */
export function useLazyModule<T>(load: LazyImport<T>): T | null {
  return moduleOf(useLazyModuleState(load, true));
}

/** The module a load state holds, or null while it loads, after it failed, or with no import. */
export function moduleOf<T>(state: LazyState<T> | null): T | null {
  return typeof state === 'object' && state !== null ? state.module : null;
}

/** How far `load` has got, pending while it loads, or null with no import for a caller that needs none. */
export function useLazyModuleState<T>(load: LazyImport<T>, isNeeded: boolean): LazyState<T> | null {
  const [state, setState] = useState(load.state);
  const isLoading = isNeeded && state === 'loading';
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
  return isNeeded ? state : null;
}

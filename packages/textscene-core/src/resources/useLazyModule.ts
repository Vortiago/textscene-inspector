/**
 * A code chunk a component loads on demand, off the webview's initial-paint path: one import shared
 * by every caller, read through effect and state. Not Suspense: `<Canvas>` mounts its own reconciler
 * root, so a suspended node would blank its siblings while it waited.
 */

import { useEffect, useState } from 'react';
import { usePendingWhile } from './usePendingWhile';

/** The module once its import lands, or why a reader has none: still loading, or failed for good. */
export type LazyState<T> = { module: T } | 'loading' | 'failed';

/** A dynamic import loaded once, which also reports how far it has got. */
export interface LazyImport<T> {
  (): Promise<T>;
  state(): LazyState<T>;
}

/**
 * `load` once, on the first call, shared by every later call. A failed import stays failed.
 *
 * @canonical A dynamic import loaded once
 */
export function memoisedImport<T>(load: () => Promise<T>): LazyImport<T> {
  let pending: Promise<T> | null = null;
  let state: LazyState<T> = 'loading';
  const memoised = () =>
    (pending ??= load().then(
      (module) => {
        state = { module };
        return module;
      },
      (error: unknown) => {
        state = 'failed';
        throw error;
      }
    ));
  return Object.assign(memoised, { state: () => state });
}

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

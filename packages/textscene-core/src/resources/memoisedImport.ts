/** A dynamic import loaded once and shared by every caller, which also reports how far it has got. */

import { createWorkCount } from './workCount.js';

/** The imports in flight. A scene draws with what they load, so it settles once none is left. */
export const moduleWork = createWorkCount();

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
  const memoised = () => {
    if (pending) return pending;
    const end = moduleWork.begin();
    pending = load().then(
      (module) => {
        state = { module };
        end();
        return module;
      },
      (error: unknown) => {
        state = 'failed';
        end();
        throw error;
      }
    );
    return pending;
  };
  return Object.assign(memoised, { state: () => state });
}

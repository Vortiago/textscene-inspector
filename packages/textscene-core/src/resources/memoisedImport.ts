/** A dynamic import loaded once and shared by every caller, which also reports how far it has got. */

/** The module once its import lands, or why a reader has none: still loading, or failed for good. */
type LazyState<T> = { module: T } | 'loading' | 'failed';

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

/**
 * Ways to wrap a cache source, the `getCached(path)` reader a live-tree or layout walk takes. A
 * null answer is a file that is loading or has failed, which a walk reads as not cached.
 */

export interface CacheSource<T> {
  getCached: (path: string) => T | null | undefined;
}

/**
 * A source that answers each path from the first of `sources` that holds it.
 *
 * @canonical A `getCached` reader for a walk
 */
export function firstCached<T>(...sources: readonly CacheSource<T>[]): CacheSource<T> {
  return {
    getCached: (path) => {
      for (const source of sources) {
        const answer = source.getCached(path);
        if (answer !== null && answer !== undefined) return answer;
      }
      return undefined;
    },
  };
}

/**
 * `source`, with each path it is asked for handed to `onRead`.
 *
 * @canonical A `getCached` reader for a walk
 */
export function recordingReads<T>(source: CacheSource<T>, onRead: (path: string) => void): CacheSource<T> {
  return {
    getCached: (path) => {
      onRead(path);
      return source.getCached(path);
    },
  };
}

/**
 * Ways to wrap a cache source, the `getCached(path)` reader a live-tree or layout walk takes. A
 * null answer is a file that is loading or has failed, which a walk reads as not cached.
 */

export interface CacheSource<T> {
  getCached: (path: string) => T | null | undefined;
}

/**
 * A source that holds nothing, for a walk with no loader: every path reads as never requested.
 *
 * @oneWay A `getCached` reader for a walk
 */
export const NOTHING_CACHED: CacheSource<never> = { getCached: () => undefined };

/**
 * A source that answers each path from the first of `sources` that holds it.
 *
 * @oneWay A `getCached` reader for a walk
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
 * `source`, with each path it is asked for handed to `onRead` with the answer it gave.
 *
 * @oneWay A `getCached` reader for a walk
 */
export function recordingReads<T>(
  source: CacheSource<T>,
  onRead: (path: string, answer: T | null | undefined) => void
): CacheSource<T> {
  return {
    getCached: (path) => {
      const answer = source.getCached(path);
      onRead(path, answer);
      return answer;
    },
  };
}

/**
 * `source`, asked once for each path: a later ask gets the first answer, a missing one included.
 * It holds one snapshot of a cache that changes in place.
 *
 * @oneWay A `getCached` reader for a walk
 */
export function answeredOnce<T>(source: CacheSource<T>): CacheSource<T> {
  const answers = new Map<string, T | null | undefined>();
  return {
    getCached: (path) => {
      const known = answers.get(path);
      if (known !== undefined || answers.has(path)) return known;
      const answer = source.getCached(path);
      answers.set(path, answer);
      return answer;
    },
  };
}

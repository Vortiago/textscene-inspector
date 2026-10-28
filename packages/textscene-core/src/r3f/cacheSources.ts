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
 * @canonical A `getCached` reader for a walk
 */
export const NOTHING_CACHED: CacheSource<never> = { getCached: () => undefined };

/**
 * `source`, with each path it is asked for handed to `onRead` with the answer it gave.
 *
 * @canonical A `getCached` reader for a walk
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

/** The named sources a build reads, as {@link keptWhileAnswered} hands them to it. */
type Sources = Readonly<Record<string, CacheSource<unknown>>>;

interface KeptValue<V, T> {
  readonly variant: V;
  /** Each source the build asked, to each path it read there and the last answer it got. */
  readonly reads: ReadonlyMap<string, ReadonlyMap<string, unknown>>;
  readonly value: T;
}

/** How {@link keptWhileAnswered} tells two variants of a key apart, and how many of one it keeps. */
export interface KeptWhileAnsweredOptions<V> {
  readonly sameVariant: (a: V, b: V) => boolean;
  /** The values one variant keeps, the oldest dropped first, for asks that alternate between sources. */
  readonly perVariant: number;
}

/**
 * A cache of a value for each key object and variant, which `build` makes over recording copies of
 * `sources`. A later ask gets the kept value while each read the build made still answers the
 * same in the sources of that ask, so a value outlives the snapshot it was built over.
 *
 * @canonical A value kept while every cache read it made answers the same
 */
export function keptWhileAnswered<K extends object, V, S extends Sources, T>({
  sameVariant,
  perVariant,
}: KeptWhileAnsweredOptions<V>): (key: K, variant: V, sources: S, build: (recording: S) => T) => T {
  /** Written only by the returned lookup. The entries clear when nothing holds the key any more. */
  const kept = new WeakMap<K, KeptValue<V, T>[]>();
  return (key, variant, sources, build) => {
    const stored = kept.get(key) ?? [];
    const same = stored.filter((entry) => sameVariant(entry.variant, variant));
    const known = same.find((entry) => stillAnswered(entry.reads, sources));
    if (known) return known.value;

    const reads = new Map<string, Map<string, unknown>>();
    const recording = Object.fromEntries(
      Object.entries(sources).map(([name, source]) => {
        const answers = new Map<string, unknown>();
        reads.set(name, answers);
        return [name, recordingReads(source, (path, answer) => answers.set(path, answer))];
      })
    ) as S;
    const value = build(recording);
    const others = stored.filter((entry) => !same.includes(entry));
    const younger = same.slice(Math.max(0, same.length - (perVariant - 1)));
    kept.set(key, [...others, ...younger, { variant, reads, value }]);
    return value;
  };
}

function stillAnswered(reads: KeptValue<unknown, unknown>['reads'], sources: Sources): boolean {
  for (const [name, answers] of reads) {
    for (const [path, answer] of answers) {
      if (sources[name]!.getCached(path) !== answer) return false;
    }
  }
  return true;
}

/**
 * `source`, asked once for each path: a later ask gets the first answer, a missing one included.
 * It holds one snapshot of a cache that changes in place.
 *
 * @canonical A `getCached` reader for a walk
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

/**
 * A set of keys that several reporters can hold at once: a key stays in the set while any of its
 * reports is open. The missing-resources panel and the undrawn-mesh list both keep one.
 */
import { useCallback, useRef, useState } from 'react';

export interface CountedReports {
  /** Each key with at least one open report. */
  reported: ReadonlySet<string>;
  /** Opens one report of `key`. Each call needs its own `clear`. An empty key reports nothing. */
  report: (key: string) => void;
  /** Withdraws one report of `key`. The key leaves `reported` when its last report is withdrawn. */
  clear: (key: string) => void;
  /** Withdraws every report of `key` at once. */
  clearAll: (key: string) => void;
}

/**
 * The actions keep one identity for the component's life, so an effect that depends on one does
 * not re-run on each change of the set.
 */
export function useCountedReports(): CountedReports {
  const [reported, setReported] = useState<ReadonlySet<string>>(() => new Set<string>());
  /** Open reports per key, written only by the actions below. */
  const reportCounts = useRef(new Map<string, number>());

  const report = useCallback((key: string) => {
    if (!key) return;
    const count = (reportCounts.current.get(key) ?? 0) + 1;
    reportCounts.current.set(key, count);
    if (count === 1) setReported((prev) => withKey(prev, key));
  }, []);

  const clearAll = useCallback((key: string) => {
    reportCounts.current.delete(key);
    setReported((prev) => withoutKey(prev, key));
  }, []);

  const clear = useCallback(
    (key: string) => {
      const count = reportCounts.current.get(key);
      if (count === undefined) return;
      if (count === 1) clearAll(key);
      else reportCounts.current.set(key, count - 1);
    },
    [clearAll]
  );

  return { reported, report, clear, clearAll };
}

/** `keys` with `key` added. The same set when it is already there, so no consumer re-renders. */
export function withKey(keys: ReadonlySet<string>, key: string): ReadonlySet<string> {
  if (keys.has(key)) return keys;
  const next = new Set(keys);
  next.add(key);
  return next;
}

/** `keys` without `key`. The same set when it is not there, so no consumer re-renders. */
export function withoutKey(keys: ReadonlySet<string>, key: string): ReadonlySet<string> {
  if (!keys.has(key)) return keys;
  const next = new Set(keys);
  next.delete(key);
  return next;
}

import { createExternalStore } from './externalStore.js';

/**
 * A set of keys that several reporters can hold at once: a key stays while any of its reports is open.
 *
 * @canonical A set of keys that several reporters hold
 *   Each report needs its own `clear`. `keys` gives a new set on each change, so a reader compares identities.
 */
export class CountedReports {
  /** Open reports per key, written only by `report`, `clear` and `clearAll`. */
  private readonly reportCounts = new Map<string, number>();
  private readonly published = createExternalStore<ReadonlySet<string>>(new Set());

  keys = (): ReadonlySet<string> => this.published.get();

  /** Calls `listener` at once on each change. Returns the removal. */
  subscribe = (listener: () => void): (() => void) => this.published.subscribe(listener);

  /** Opens one report of `key`. An empty key reports nothing. */
  report = (key: string): void => {
    if (!key) return;
    const count = (this.reportCounts.get(key) ?? 0) + 1;
    this.reportCounts.set(key, count);
    if (count === 1) this.publish();
  };

  /** Withdraws one report of `key`. The key leaves the set with its last report. */
  clear = (key: string): void => {
    const count = this.reportCounts.get(key);
    if (count === undefined) return;
    if (count === 1) this.clearAll(key);
    else this.reportCounts.set(key, count - 1);
  };

  /** Withdraws every report of `key` at once. */
  clearAll = (key: string): void => {
    if (this.reportCounts.delete(key)) this.publish();
  };

  private publish(): void {
    this.published.set(new Set(this.reportCounts.keys()));
  }
}

/** A set of keys that several reporters can hold at once: a key stays while any of its reports is open. */
export class CountedReports {
  private readonly listeners = new Set<() => void>();
  /** Open reports per key, written only by `report`, `clear` and `clearAll`. */
  private readonly reportCounts = new Map<string, number>();
  /** A new set on each change, so a reader compares identities. Written only by `publish`. */
  private current: ReadonlySet<string> = new Set();

  keys = (): ReadonlySet<string> => this.current;

  /** Calls `listener` at once on each change. Returns the removal. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Opens one report of `key`. Each call needs its own `clear`. An empty key reports nothing. */
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
    this.current = new Set(this.reportCounts.keys());
    for (const listener of [...this.listeners]) listener();
  }
}

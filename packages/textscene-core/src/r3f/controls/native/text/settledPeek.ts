import type { WorkCount } from '../../../../resources/workCount';

type PeekEntry<T> = { status: 'pending' } | { status: 'settled'; value: T };

/**
 * Undefined until the load the first peek starts settles. `work` counts it until then. A load never rejects.
 *
 * @canonical A peek over async loads keyed by object, counted as font work
 */
export function createSettledPeek<K extends object, T>(
  work: WorkCount,
  onPending: (key: K) => void,
  onSettle: (key: K) => void
): (key: K, load: () => Promise<T>) => T | undefined {
  const entries = new WeakMap<K, PeekEntry<T>>();

  async function settle(key: K, load: () => Promise<T>): Promise<void> {
    const endWork = work.begin();
    entries.set(key, { status: 'pending' });
    const value = await load();
    entries.set(key, { status: 'settled', value });
    try {
      onSettle(key);
    } finally {
      // A throwing listener must not leave the work counted: a capture waits on it for good.
      endWork();
    }
  }

  return (key, load) => {
    const entry = entries.get(key);
    if (entry?.status === 'settled') return entry.value;
    if (!entry) void settle(key, load);
    onPending(key);
    return undefined;
  };
}

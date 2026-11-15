/**
 * The work count a capture waits on, and the peek over font loads keyed by object. The settled
 * fonts of a preview (`settledFonts.ts`) build their peeks here, and each peek wakes its own preview.
 */
import { createWorkCount } from '../../../../resources/workCount';

/**
 * The scene font loads in flight in the page, from the peek that starts one until it settles. The
 * shell shows "Loading scene…" meanwhile, so a capture never settles on the bundled default.
 */
export const fontWork = createWorkCount();

type PeekEntry<T> = { status: 'pending' } | { status: 'settled'; value: T };

/**
 * A peek over loads keyed by object. The first peek of a key starts its load and answers
 * undefined, and a peek after the load settles answers its value. A peek of a load in flight calls
 * `onPending` with its key, and each settle calls `onSettle` with it. A load never rejects: it
 * settles on a fallback value. A `WeakMap` frees the entry of an evicted key.
 *
 * @canonical A peek over async loads keyed by object, counted as font work
 */
export function createSettledPeek<K extends object, T>(
  onPending: (key: K) => void,
  onSettle: (key: K) => void
): (key: K, load: () => Promise<T>) => T | undefined {
  const entries = new WeakMap<K, PeekEntry<T>>();

  async function settle(key: K, load: () => Promise<T>): Promise<void> {
    const endWork = fontWork.begin();
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

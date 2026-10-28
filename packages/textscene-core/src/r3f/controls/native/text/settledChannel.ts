/**
 * The channel a font load settles through: the count and the listeners that wake a reader built
 * without the font, the work count a capture waits on, and the peek over loads keyed by object.
 * `sceneFontLoader.ts` and `sceneFontOutlines.ts` both settle through it.
 */
import { createWorkCount } from '../../../../resources/workCount';
import { createExternalStore } from '../../../hooks/createExternalStore';

/**
 * How many loads have settled, never reset. Written only by `notifySceneFontSettled`. A hook
 * reads the count as the snapshot of `useSyncExternalStore`, so a load that settles between its
 * render and its subscription still re-renders it.
 */
const settleCount = createExternalStore(0);

export const sceneFontSettleCount = settleCount.get;

/**
 * Subscribes to a font metrics load settling, and returns an unsubscribe function. It fires once per
 * resource on its first settle and once for the bundled font, never for a font that short-circuits
 * synchronously.
 */
export const onSceneFontSettled = settleCount.subscribe;

/**
 * Fires every settled listener, for a scene font load and for the bundled font registration. A
 * throwing listener does not stop the later ones: the store rethrows the first error once all
 * have run.
 */
export function notifySceneFontSettled(): void {
  settleCount.set(settleCount.get() + 1);
}

/**
 * The scene font loads in flight, from the peek that starts one until it settles. The shell shows
 * "Loading scene…" meanwhile, so a capture never settles on the bundled default.
 */
export const fontWork = createWorkCount();

type PeekEntry<T> = { status: 'pending' } | { status: 'settled'; value: T };

/**
 * A peek over loads keyed by object. The first peek of a key starts its load and answers
 * undefined, and a peek after the load settles answers its value. A settle wakes the readers that
 * built without it. A load never rejects: it settles on a fallback value. A `WeakMap` frees the
 * entry of an evicted key.
 *
 * @canonical A peek over async loads keyed by object, counted as font work
 */
export function createSettledPeek<K extends object, T>(): (key: K, load: () => Promise<T>) => T | undefined {
  const entries = new WeakMap<K, PeekEntry<T>>();

  async function settle(key: K, load: () => Promise<T>): Promise<void> {
    const endWork = fontWork.begin();
    entries.set(key, { status: 'pending' });
    const value = await load();
    entries.set(key, { status: 'settled', value });
    try {
      notifySceneFontSettled();
    } finally {
      // A throwing listener must not leave the work counted: a capture waits on it for good.
      endWork();
    }
  }

  return (key, load) => {
    const entry = entries.get(key);
    if (entry) return entry.status === 'settled' ? entry.value : undefined;
    void settle(key, load);
    return undefined;
  };
}

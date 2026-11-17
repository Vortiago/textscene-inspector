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
 * A peek over loads keyed by object: undefined until the key's load settles, then its value.
 *
 * @canonical A peek over async loads keyed by object, counted as font work
 */
export function createSettledPeek<K extends object, T>(
  onPending: (key: K) => void,
  onSettle: (key: K) => void
): (key: K, load: () => Promise<T>) => T | undefined {
  const entries = new WeakMap<K, PeekEntry<T>>();

  async function settle(key: K, load: () => Promise<T>): Promise<void> {
    const loaded = load();
    // A peek runs while React renders, and a count told now updates another component mid-render.
    await Promise.resolve();
    const endWork = fontWork.begin();
    const value = await loaded;
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
    if (!entry) {
      entries.set(key, { status: 'pending' });
      void settle(key, load);
    }
    onPending(key);
    return undefined;
  };
}

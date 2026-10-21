/** Disposes an object a component built, once the component stops holding it. */

import { useEffect } from 'react';

interface Disposable {
  dispose(): void;
}

/** How many mounted holders each object has. Written only by `useDisposeOnRelease`. */
const holders = new WeakMap<Disposable, number>();

/**
 * Disposes `object` when the last component holding it lets go: it unmounts, or it holds another
 * object. A microtask, not now: StrictMode releases and takes the object again in one task, and
 * disposing it then makes three upload it a second time.
 */
export function useDisposeOnRelease(object: Disposable | null | undefined): void {
  useEffect(() => {
    if (!object) return undefined;
    holders.set(object, (holders.get(object) ?? 0) + 1);
    return () => {
      holders.set(object, holders.get(object)! - 1);
      queueMicrotask(() => {
        if (holders.get(object) === 0) object.dispose();
      });
    };
  }, [object]);
}

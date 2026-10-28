/** Disposes an object once nothing holds it: a component through a hook, or any other owner through a hold. */

import { useEffect } from 'react';

interface Disposable {
  dispose(): void;
}

/** How many holders each object has. Written only by `holdUntilReleased`, and cleared when the object is disposed. */
const holders = new WeakMap<Disposable, number>();

/**
 * Holds `object` until the returned release runs, which counts once however often it is called.
 * The last release disposes the object in a microtask, not now: StrictMode and a swapped consumer
 * release and hold the object again in one task, and disposing it then makes three upload it a second time.
 *
 * @canonical Mesh content and its disposal
 */
export function holdUntilReleased(object: Disposable): () => void {
  holders.set(object, (holders.get(object) ?? 0) + 1);
  let isReleased = false;
  return () => {
    if (isReleased) return;
    isReleased = true;
    holders.set(object, holders.get(object)! - 1);
    queueMicrotask(() => disposeIfUnheld(object));
  };
}

/** Whether a hold on `object` is still open. */
export function isHeld(object: Disposable): boolean {
  return (holders.get(object) ?? 0) > 0;
}

/**
 * Disposes `object` when the last component holding it lets go: it unmounts, or it holds another object.
 *
 * @canonical Mesh content and its disposal
 */
export function useDisposeOnRelease(object: Disposable | null | undefined): void {
  useEffect(() => (object ? holdUntilReleased(object) : undefined), [object]);
}

function disposeIfUnheld(object: Disposable): void {
  if (holders.get(object) !== 0) return;
  // Cleared, so a second holder that let go in the same task does not dispose it again.
  holders.delete(object);
  object.dispose();
}

/**
 * How many procedural textures are still being built or uploaded, page-wide.
 * The preview shows a status while it is above zero, and a capture waits for
 * that status to clear, so a frame never settles on a texture still in flight.
 */

/** Written only by `beginTextureWork` and the end it returns. */
let pending = 0;
const listeners = new Set<() => void>();

/** Counts one piece of work until the returned end runs. The end is idempotent. */
export function beginTextureWork(): () => void {
  pending += 1;
  notify();
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    pending -= 1;
    notify();
  };
}

export function pendingTextureWork(): number {
  return pending;
}

/** Calls `listener` on every change of the count. Returns the unsubscribe. */
export function subscribeTextureWork(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const listener of listeners) listener();
}

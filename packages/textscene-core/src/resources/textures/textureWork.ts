/**
 * How many procedural textures are still being built or uploaded, page-wide.
 * The preview shows a status while it is above zero, and a capture waits for
 * that status to clear, so a frame never settles on a texture still in flight.
 */

import { createExternalStore } from '../../r3f/hooks/createExternalStore.js';

/** Written only by `beginTextureWork` and the end it returns. */
const pending = createExternalStore(0);

/** Counts one piece of work until the returned end runs. The end is idempotent. */
export function beginTextureWork(): () => void {
  pending.set(pending.get() + 1);
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    pending.set(pending.get() - 1);
  };
}

export const pendingTextureWork = pending.get;

/** Calls `listener` on every change of the count. Returns the unsubscribe. */
export const subscribeTextureWork = pending.subscribe;

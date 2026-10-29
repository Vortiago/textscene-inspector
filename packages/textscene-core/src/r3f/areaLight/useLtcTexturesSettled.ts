/**
 * Loads Godot's LTC tables on the first area light a scene shows: they are the largest data in the
 * webview, and a scene with no area light never reads them.
 */

import { useEffect, useState } from 'react';
import { usePendingWhile } from '../../resources/usePendingWhile.js';
import { warn } from '../../logger.js';

/** Written only by `loadLtcTextures`, on its first call. It never clears: a failed import stays failed. */
let ltcTexturesLoad: Promise<void> | null = null;
/** Set by `loadLtcTextures` once the load settles, so a later light waits for nothing. */
let isSettled = false;

function loadLtcTextures(): Promise<void> {
  ltcTexturesLoad ??= import('./ltcTextures.js')
    .then(
      (m) => m.installLtcTextures(),
      (error: unknown) => warn(`[useLtcTexturesSettled] Godot's LTC tables failed to load: ${String(error)}`)
    )
    .finally(() => {
      isSettled = true;
    });
  return ltcTexturesLoad;
}

/**
 * Whether the load of Godot's tables has settled. The first call starts it, and the caller counts
 * as one pending load until it settles. A light shows only once it has: three binds the tables to a
 * program when its light count changes, and never again while the count stays.
 */
export function useLtcTexturesSettled(): boolean {
  const [isLoading, setLoading] = useState(!isSettled);
  useEffect(() => {
    if (isLoading) void loadLtcTextures().then(() => setLoading(false));
  }, [isLoading]);
  usePendingWhile(isLoading);
  return !isLoading;
}

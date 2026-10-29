/**
 * Loads Godot's LTC tables on the first area light a scene shows: they are the largest data in the
 * webview, and a scene with no area light never reads them. Until they load, three samples no
 * texture for an area light's specular, and the light holds the loader pending.
 */

import { useEffect, useState } from 'react';
import { usePendingWhile } from '../../resources/usePendingWhile';
import { warn } from '../../logger.js';

/** Written only by `loadLtcTextures`, on its first call. It never clears: a failed import stays failed. */
let ltcTexturesLoad: Promise<void> | null = null;
/** Set by `loadLtcTextures` once the tables are installed, so a later light holds nothing pending. */
let isInstalled = false;

function loadLtcTextures(): Promise<void> {
  ltcTexturesLoad ??= import('./ltcTextures.js').then((m) => {
    m.installLtcTextures();
    isInstalled = true;
  });
  return ltcTexturesLoad;
}

/** Starts the tables' load, and counts the caller as one pending load until they are installed. */
export function useLtcTextures(): void {
  const [isLoading, setLoading] = useState(!isInstalled);
  useEffect(() => {
    if (!isLoading) return undefined;
    let isMounted = true;
    loadLtcTextures().then(
      () => {
        if (isMounted) setLoading(false);
      },
      (error: unknown) => {
        warn(`[useLtcTextures] Godot's LTC tables failed to load: ${String(error)}`);
        if (isMounted) setLoading(false);
      }
    );
    return () => {
      isMounted = false;
    };
  }, [isLoading]);
  usePendingWhile(isLoading);
}

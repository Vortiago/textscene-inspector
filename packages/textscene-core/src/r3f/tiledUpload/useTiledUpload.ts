/**
 * The draw-site half of the tiled upload. A consumer passes the exact texture it
 * draws, since three uploads each clone with its own sampler settings separately,
 * and gets it back once every row is on the GPU. Until then it keeps getting the
 * texture it had, so an edit never blanks the slot.
 */

import { useContext, useEffect, useRef, useState } from 'react';
import type * as THREE from 'three';
import { beginTextureWork } from '../../resources/textures/textureWork';
import { TiledUploadContext } from './TiledUploadContext';

/**
 * `texture` once it is on the GPU, else the texture shown before it, else null.
 * The hook owns disposal: every texture it was given goes to `retire` once it is
 * neither the input nor on screen, and all of them go on unmount.
 */
export function useTiledUpload<T extends THREE.Texture>(
  texture: T | null,
  retire: (texture: T) => void
): T | null {
  const queue = useContext(TiledUploadContext);
  const isTiled = texture !== null && queue !== null && queue.needsTiling(texture);
  /** The newest tiled texture whose upload finished. Set only there, so a pass-through never renders twice. */
  const [uploaded, setUploaded] = useState<T | null>(null);
  /** Written after each commit: what the hook showed, kept while a tiled texture uploads. */
  const lastShown = useRef<T | null>(null);

  useEffect(() => {
    if (!isTiled || !texture || !queue) return undefined;
    const upload = queue.enqueue(texture);
    const endWork = beginTextureWork();
    let current = true;
    void upload.done.then((isUploaded) => {
      endWork();
      if (current && isUploaded) setUploaded(texture);
    });
    return () => {
      current = false;
      upload.cancel();
      endWork();
    };
  }, [texture, queue, isTiled]);

  const shown = !isTiled ? texture : uploaded === texture ? texture : lastShown.current;
  useEffect(() => {
    lastShown.current = shown;
  });
  useRetired([texture, shown], retire);
  return shown;
}

/**
 * A consumer's own texture clone as it draws: uploaded in bands where large, and
 * disposed once it no longer draws. Every component that clones a texture to draw
 * it goes through here (`drawnCloneGuard.test.ts`).
 */
export function useUploadedClone<T extends THREE.Texture>(clone: T | null): T | null {
  return useTiledUpload(clone, disposeTexture);
}

function disposeTexture(texture: THREE.Texture): void {
  texture.dispose();
}

/**
 * Calls `retire` once for each texture that leaves `live`, and for every texture
 * still held on unmount.
 */
function useRetired<T>(live: readonly (T | null)[], retire: (texture: T) => void): void {
  /** Written after each commit: every texture given and not yet retired. */
  const held = useRef(new Set<T>());
  useEffect(() => {
    const stillLive = new Set(live);
    for (const texture of held.current) {
      if (stillLive.has(texture)) continue;
      held.current.delete(texture);
      retire(texture);
    }
    for (const texture of live) if (texture !== null) held.current.add(texture);
  });
  useEffect(() => {
    const textures = held.current;
    return () => {
      textures.forEach((texture) => retire(texture));
      textures.clear();
    };
    // Every caller passes a module-level `retire`, so the first one is the last one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

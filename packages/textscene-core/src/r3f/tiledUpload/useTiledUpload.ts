/**
 * The draw-site half of the tiled upload. A consumer passes the exact texture it
 * draws, since three uploads each clone with its own sampler settings separately,
 * and gets it back once every row is on the GPU. Until then it keeps getting the
 * texture it had, so an edit never blanks the slot.
 */

import { useContext, useEffect, useRef, useState } from 'react';
import type * as THREE from 'three';
import { textureWork } from '../../resources/textures/textureWork';
import { useNearestAnisotropy } from '../nearestAnisotropy';
import { TiledUploadContext } from './TiledUploadContext';

/**
 * `texture` once it is on the GPU, else the texture shown before it, else null. The caller frees
 * what it passed in: a texture on screen may be an earlier input.
 */
export function useTiledUpload<T extends THREE.Texture>(texture: T | null): T | null {
  const queue = useContext(TiledUploadContext);
  const isTiled = texture !== null && queue !== null && queue.needsTiling(texture);
  /** The newest tiled texture whose upload finished. Set only there, so a pass-through never renders twice. */
  const [uploaded, setUploaded] = useState<T | null>(null);
  /** Written after each commit: what the hook showed, kept while a tiled texture uploads. */
  const lastShown = useRef<T | null>(null);

  useEffect(() => {
    if (!isTiled || !texture || !queue) return undefined;
    const upload = queue.enqueue(texture);
    const endWork = textureWork.begin();
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
  // After the effect above, which allocates a large texture's storage empty.
  useNearestAnisotropy(texture);
  return shown;
}

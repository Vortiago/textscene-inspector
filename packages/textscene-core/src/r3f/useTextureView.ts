/**
 * The draw-site half of a texture view: a consumer states the sampler it needs and draws the
 * texture it gets back, which the hook has made once, uploaded in bands where large, and frees once
 * nothing draws it.
 */

import { useMemo } from 'react';
import type * as THREE from 'three';
import {
  ownedTextureView,
  sameViewSampler,
  textureView,
  viewToRelease,
  type ViewSampler,
} from '../resources/textures/textureView';
import { useByValue } from './hooks/useByValue';
import { useTiledUpload } from './tiledUpload/useTiledUpload';
import { useDisposeOnRelease } from './useDisposeOnRelease';

/**
 * `source` as `sampler` samples it: the source itself when it already does, else one clone. Null
 * without a source, and the source itself without a sampler. A sampler is compared by value, so a
 * render that states the same values keeps the view and uploads nothing.
 *
 * @canonical A texture view a component draws
 *   `useOwnedTextureView` for a consumer that writes the clone.
 */
export function useTextureView(
  source: THREE.Texture | null | undefined,
  sampler: ViewSampler | null | undefined
): THREE.Texture | null {
  return useView(source, sampler, sharedView);
}

/**
 * `useTextureView` that always draws a clone, which the consumer may write, as a sprite moves its
 * window to the next frame. Null without a source or a sampler: a consumer with nothing to sample
 * states none.
 */
export function useOwnedTextureView(
  source: THREE.Texture | null | undefined,
  sampler: ViewSampler | null | undefined
): THREE.Texture | null {
  return useView(source, sampler, ownedView);
}

type MakeView = (source: THREE.Texture, sampler: ViewSampler | null | undefined) => THREE.Texture | null;

const sharedView: MakeView = (source, sampler) => (sampler ? textureView(source, sampler) : source);

const ownedView: MakeView = (source, sampler) => (sampler ? ownedTextureView(source, sampler) : null);

function useView(
  source: THREE.Texture | null | undefined,
  sampler: ViewSampler | null | undefined,
  make: MakeView
): THREE.Texture | null {
  const stated = useByValue(sampler, sameViewSampler);
  const view = useMemo(() => (source ? make(source, stated) : null), [source, stated, make]);
  return useDrawnView(view);
}

/**
 * Both the view and the texture on screen are held: a texture is freed once it is neither, so the
 * previous view keeps drawing while a large new one uploads.
 */
function useDrawnView(view: THREE.Texture | null): THREE.Texture | null {
  const drawn = useTiledUpload(view);
  useDisposeOnRelease(viewToRelease(view));
  // One hold per object: the drawn texture is the view itself except while a new one uploads.
  useDisposeOnRelease(drawn === view ? null : viewToRelease(drawn));
  return drawn;
}

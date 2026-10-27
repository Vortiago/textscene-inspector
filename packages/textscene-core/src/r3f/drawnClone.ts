/**
 * The clone a component draws in place of a shared texture: `useResource` hands one texture to every
 * consumer of a path, so each consumer writes its colour space, filter, wrap and UV window on its own
 * clone. The clone shares the `Source`, so it uploads no second copy of the image.
 */
import type * as THREE from 'three';
import { pinColorSpace } from '../resources/textures/applyTextureState';
import { applyTextureFilterState, type TextureFilterState } from '../resources/textures/godotTextureFilter';
import { applyUvWindow, type UvWindow } from './uvWindow';

/** What a clone samples differently from its source. A field left out keeps the source's value. */
export interface CloneSampler {
  colorSpace?: THREE.ColorSpace;
  filter?: TextureFilterState;
  wrap?: THREE.Wrapping;
  window?: UvWindow;
}

/**
 * A clone of `texture` that samples with `sampler`. The caller sets every sampler field here, before
 * the clone reaches `useUploadedClone`: a change after the upload moves three's cache key, and three
 * uploads the whole image again at the next draw.
 *
 * @oneWay A texture clone that a node draws
 *   Set every sampler field through it, before the upload.
 */
export function drawnClone(texture: THREE.Texture, sampler: CloneSampler): THREE.Texture {
  const clone = texture.clone();
  // A pin, not an assignment: `@react-three/fiber` retags a texture on a `map` prop as sRGB.
  if (sampler.colorSpace !== undefined) pinColorSpace(clone, sampler.colorSpace);
  if (sampler.filter) applyTextureFilterState(clone, sampler.filter);
  if (sampler.wrap !== undefined) clone.wrapS = clone.wrapT = sampler.wrap;
  if (sampler.window) applyUvWindow(clone, sampler.window);
  clone.needsUpdate = true;
  return clone;
}

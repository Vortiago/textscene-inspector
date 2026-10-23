/** The one GPU texture an atlas fills in place, whatever three clones. */

import * as THREE from 'three';
import { sharedTexture } from '../sharedTexture.js';
import type { MipLevel } from '../../resources/processing/mipChain.js';

export class AtlasTexture extends sharedTexture(THREE.DataTexture) {
  constructor(name: string, colorSpace: THREE.ColorSpace) {
    super(null, 1, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.name = name;
    this.colorSpace = colorSpace;
    this.generateMipmaps = false;
    this.minFilter = THREE.LinearMipmapLinearFilter;
    this.magFilter = THREE.LinearFilter;
  }
}

/**
 * Fills `atlas` with `levels`, the largest first. A function, not a method: a dev server reload
 * hands an `AtlasTexture` an earlier evaluation built, and this reads only its public fields.
 * A texture's GPU storage keeps its first size, so a new size drops the old storage before the
 * levels upload. The same size uploads into it.
 */
export function holdAtlasLevels(atlas: THREE.DataTexture, levels: readonly MipLevel[]): void {
  const [base] = levels;
  if (base && (base.width !== atlas.image.width || base.height !== atlas.image.height)) atlas.dispose();
  atlas.mipmaps = [...levels];
  atlas.image = base as unknown as typeof atlas.image;
  atlas.needsUpdate = true;
}

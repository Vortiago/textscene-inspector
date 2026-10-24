/** The one GPU texture an atlas fills in place, whatever three clones. */

import * as THREE from 'three';
import { sharedTexture } from '../sharedTexture.js';
import type { MipLevel } from '../../resources/processing/mipChain.js';
import { carryDefaultMipChain } from '../../resources/textures/texelTexture.js';

export class AtlasTexture extends sharedTexture(THREE.DataTexture) {
  constructor(name: string, colorSpace: THREE.ColorSpace) {
    super(null, 1, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.name = name;
    this.colorSpace = colorSpace;
    this.generateMipmaps = false;
    this.magFilter = THREE.LinearFilter;
  }
}

/**
 * Fills `atlas` with `levels`, the largest first, through `carryDefaultMipChain`. A function, not a
 * method: a dev server reload hands an `AtlasTexture` an earlier evaluation built, and this reads
 * only its public fields. A texture's GPU storage keeps its first size, so a new size drops the old
 * storage before the levels upload. The same size uploads into it. An atlas is always a chain, so
 * fewer than two levels is an error.
 */
export function holdAtlasLevels(atlas: THREE.DataTexture, levels: readonly MipLevel[]): void {
  const [base] = levels;
  if (!base || levels.length < 2) throw new Error(`expected at least 2 atlas levels, got ${levels.length}`);
  if (base.width !== atlas.image.width || base.height !== atlas.image.height) atlas.dispose();
  carryDefaultMipChain(atlas, [...levels]);
  atlas.image = base as unknown as typeof atlas.image;
  atlas.needsUpdate = true;
}

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

  /**
   * Holds `levels`, the largest first. A texture's GPU storage keeps its first size, so a new size
   * drops the old storage before the levels upload. The same size uploads into it.
   */
  hold(levels: readonly MipLevel[]): void {
    const [base] = levels;
    if (base && (base.width !== this.image.width || base.height !== this.image.height)) this.dispose();
    this.mipmaps = [...levels];
    this.image = base as unknown as typeof this.image;
    this.needsUpdate = true;
  }
}

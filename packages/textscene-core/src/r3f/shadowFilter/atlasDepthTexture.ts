/**
 * The depth texture of a shadow atlas that the soft shadow filter samples: a depth compare under a
 * linear filter, and one texture that every material samples through one sampler.
 */

import * as THREE from 'three';
import { sharedTexture } from '../sharedTexture.js';

export interface AtlasDepth {
  name: string;
  size: number;
  type: THREE.TextureDataType;
  compare: THREE.TextureComparisonFunction;
}

export class AtlasDepthTexture extends sharedTexture(THREE.DepthTexture) {
  constructor({ name, size, type, compare }: AtlasDepth) {
    super(size, size, type);
    this.name = name;
    this.format = THREE.DepthFormat;
    this.compareFunction = compare;
    this.minFilter = THREE.LinearFilter;
    this.magFilter = THREE.LinearFilter;
  }
}

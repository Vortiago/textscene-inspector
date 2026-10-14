/**
 * The depth texture of a shadow atlas that the soft shadow filter samples: a depth compare under a
 * linear filter, and one texture that every material samples through one sampler.
 */

import * as THREE from 'three';
import { sharedTexture } from '../sharedTexture.js';
import { AtlasColourTexture } from './atlasColourTexture.js';

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

/** The render target `depth` belongs to, or null for anything else, such as an uninstalled uniform. */
export function atlasTargetOf(depth: unknown): THREE.WebGLRenderTarget | null {
  if (!(depth instanceof THREE.DepthTexture)) return null;
  return depth.renderTarget instanceof THREE.WebGLRenderTarget ? depth.renderTarget : null;
}

/**
 * A shadow atlas as three builds a PCF shadow map (r186 `WebGLShadowMap.js:253-266`): the depth
 * texture `depth` describes, and its colour copy named after it.
 */
export function createShadowAtlas(depth: AtlasDepth): THREE.WebGLRenderTarget {
  const atlas = new THREE.WebGLRenderTarget(depth.size, depth.size);
  atlas.texture = new AtlasColourTexture(`${depth.name}Colour`, depth.size);
  atlas.depthTexture = new AtlasDepthTexture(depth);
  return atlas;
}

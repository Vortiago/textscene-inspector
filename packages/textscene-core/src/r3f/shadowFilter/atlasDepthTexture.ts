/**
 * The depth texture of a shadow atlas that the soft shadow filter samples: a depth compare under a
 * linear filter, and one texture that every material samples through one sampler.
 */

import * as THREE from 'three';

export interface AtlasDepth {
  name: string;
  size: number;
  type: THREE.TextureDataType;
  compare: THREE.TextureComparisonFunction;
}

/**
 * `cloneUniforms` clones a texture for each material (three r186 `UniformsUtils.js:28-39`), and a
 * clone would name a texture no shadow pass draws. So a clone of this texture is the texture itself.
 */
export class AtlasDepthTexture extends THREE.DepthTexture {
  constructor({ name, size, type, compare }: AtlasDepth) {
    super(size, size, type);
    this.name = name;
    this.format = THREE.DepthFormat;
    this.compareFunction = compare;
    this.minFilter = THREE.LinearFilter;
    this.magFilter = THREE.LinearFilter;
  }

  override clone(): this {
    return this;
  }
}

/** The render target `depth` belongs to, or null for anything else, such as an uninstalled uniform. */
export function atlasTargetOf(depth: unknown): THREE.WebGLRenderTarget | null {
  if (!(depth instanceof THREE.DepthTexture)) return null;
  return depth.renderTarget instanceof THREE.WebGLRenderTarget ? depth.renderTarget : null;
}

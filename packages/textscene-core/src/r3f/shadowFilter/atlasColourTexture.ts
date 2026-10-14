/**
 * The colour of a shadow atlas: the depth again, as two bytes, that a depth draw writes
 * (`atlasDepthMaterials.ts`) and a blocker search reads raw (`godotRawDepth`). Godot reads its depth
 * with a second, uncompared sampler (`scene_forward_lights_inc.glsl:398`), and a lit draw cannot read
 * one depth texture both ways.
 */

import * as THREE from 'three';

/**
 * A render target's texture would reach each material's clone as null (three r186
 * `UniformsUtils.js:32-35`), so a clone of this one is itself.
 */
export class AtlasColourTexture extends THREE.Texture {
  constructor(name: string, size: number) {
    super();
    this.name = name;
    this.image = { width: size, height: size, depth: 1 };
    this.format = THREE.RGFormat;
    this.type = THREE.UnsignedByteType;
    this.minFilter = THREE.NearestFilter;
    this.magFilter = THREE.NearestFilter;
    this.generateMipmaps = false;
    this.flipY = false;
  }

  override clone(): this {
    return this;
  }
}

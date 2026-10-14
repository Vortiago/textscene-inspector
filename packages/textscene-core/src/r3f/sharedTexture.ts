/**
 * A texture that every material samples as one object, whatever three clones.
 */

import type * as THREE from 'three';

// A mixin's constructor must take `...args: any[]` (TypeScript error 2545).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TextureClass = abstract new (...args: any[]) => THREE.Texture;

/**
 * `cloneUniforms` clones a texture for each material (three r186 `UniformsUtils.js:28-39`). A
 * clone would hold the pixels it was cloned with, or null for a render target's texture
 * (`UniformsUtils.js:32-35`). So a clone of a shared texture is the texture itself.
 */
export function sharedTexture<T extends TextureClass>(Base: T) {
  abstract class SharedTexture extends Base {
    override clone(): this {
      return this;
    }
  }
  return SharedTexture;
}

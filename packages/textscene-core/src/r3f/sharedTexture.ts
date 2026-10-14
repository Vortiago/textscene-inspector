/**
 * A texture that every material samples as one object, whatever three clones, and the GL handle it
 * shows: a slot takes another texture's handle, as three's `XREstimatedLight.js:62-70` does, so a
 * switch uploads nothing.
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

/** The part of three's per-renderer state of a texture that holds its GL handle. */
interface TextureHandle {
  __webglTexture?: WebGLTexture;
}

function handleOf(renderer: THREE.WebGLRenderer, texture: THREE.Texture): TextureHandle {
  return renderer.properties.get(texture) as TextureHandle;
}

/** Points `slot` at `texture`'s GL handle on `renderer`. */
export function showInSlot(renderer: THREE.WebGLRenderer, slot: THREE.Texture, texture: THREE.Texture): void {
  handleOf(renderer, slot).__webglTexture = handleOf(renderer, texture).__webglTexture;
}

/** Takes `slot` off `texture` before it is freed: binding a deleted texture is an error. */
export function leaveSlot(renderer: THREE.WebGLRenderer, slot: THREE.Texture, texture: THREE.Texture): void {
  const shown = handleOf(renderer, slot);
  if (shown.__webglTexture === handleOf(renderer, texture).__webglTexture) delete shown.__webglTexture;
}

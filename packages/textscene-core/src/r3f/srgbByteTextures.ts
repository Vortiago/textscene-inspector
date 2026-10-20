/**
 * Render-target textures whose storage holds sRGB bytes, which a canvas consumer filters raw and
 * multiplies in sRGB (`canvasSrgbMultiply.ts`).
 */
import type * as THREE from 'three';

/**
 * The render-target textures whose storage holds sRGB bytes under the sRGB tag their pass encodes
 * through. R3F stamps the same tag on any bound `map`, so the tag cannot tell them apart. Written
 * only by `markSrgbBytes`, and an entry goes with its texture.
 */
const srgbByteTextures = new WeakSet<THREE.Texture>();

/** Marks `texture` as holding sRGB bytes that a canvas consumer filters raw. Returns it. */
export function markSrgbBytes(texture: THREE.Texture): THREE.Texture {
  srgbByteTextures.add(texture);
  return texture;
}

/** Whether `texture` holds sRGB bytes under its sRGB tag, as a canvas-content target does. */
export function holdsSrgbBytes(texture: THREE.Texture): boolean {
  return srgbByteTextures.has(texture);
}

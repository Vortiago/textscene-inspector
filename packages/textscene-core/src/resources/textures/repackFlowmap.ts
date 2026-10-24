import * as THREE from 'three';
import { readImagePixels, type ImagePixels } from '../formats/image/imagePixels';
import { texelTexture } from './texelTexture';
import type { MipLevel } from '../processing/mipChain';

/**
 * Repacks a Godot anisotropy_flowmap's alpha strength into the blue channel three.js
 * reads, on a new DataTexture: `Texture.clone()` shares the cached Source. `undefined`
 * when no pixels are readable, so the material keeps scalar-only anisotropy. The
 * caller disposes the returned texture.
 */
export function repackAnisotropyFlowmap(texture: THREE.Texture): THREE.Texture | undefined {
  const levels = flowmapLevels(texture);
  if (!levels) return undefined;
  const out = texelTexture(texture, levels.map(alphaInBlue));
  // anisotropyMap is non-colour data (direction and strength): three.js requires NoColorSpace.
  out.colorSpace = THREE.NoColorSpace;
  return out;
}

/**
 * The flowmap's levels: the chain it carries, else its readable image alone. A half-float chain
 * is no bytes, so such a flowmap reads its top level through `readImagePixels`, which clamps it.
 */
function flowmapLevels(texture: THREE.Texture): ImagePixels[] | undefined {
  if (texture.mipmaps.length > 1 && texture.type === THREE.UnsignedByteType) {
    return texture.mipmaps as ImagePixels[];
  }
  const pixels = readImagePixels(texture.image);
  return pixels && [pixels];
}

/** A copy of `level` whose blue holds its alpha, per texel. */
function alphaInBlue({ data, width, height }: ImagePixels): MipLevel {
  const repacked = new Uint8Array(data);
  for (let i = 0; i < repacked.length; i += 4) repacked[i + 2] = data[i + 3]!;
  return { data: repacked, width, height };
}

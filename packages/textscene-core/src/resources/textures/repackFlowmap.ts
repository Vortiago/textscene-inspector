import * as THREE from 'three';
import { readImagePixels } from '../formats/image/imagePixels';
import { copySampling } from './copySampling';

/**
 * Repacks a Godot anisotropy_flowmap's alpha strength into the blue channel three.js
 * reads, on a new DataTexture: `Texture.clone()` shares the cached Source. `undefined`
 * when no pixels are readable, so the material keeps scalar-only anisotropy. The
 * caller disposes the returned texture.
 */
export function repackAnisotropyFlowmap(texture: THREE.Texture): THREE.Texture | undefined {
  const pixels = readImagePixels(texture.image);
  if (!pixels) return undefined;

  const src = pixels.data;
  // Alpha (byte 3) to blue (byte 2), per pixel.
  const dst = new Uint8Array(src);
  for (let i = 0; i < dst.length; i += 4) {
    const alpha = src[i + 3]!;
    dst[i + 2] = alpha;
  }

  // The source's sampling, so the repack changes channels and nothing else.
  const out = copySampling(
    new THREE.DataTexture(dst, pixels.width, pixels.height, THREE.RGBAFormat),
    texture
  );
  out.needsUpdate = true;
  // anisotropyMap is non-colour data (direction and strength): three.js requires NoColorSpace.
  out.colorSpace = THREE.NoColorSpace;
  out.flipY = texture.flipY;
  return out;
}

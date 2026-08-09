/**
 * Pure functions for texture processing.
 * Extracted from TextureLoader for use with createResourceProcessor.
 */

import * as THREE from 'three';
import { readImagePixels, type ImagePixels } from '../../r3f/controls/withImageCanvas';
import { everyTransparentTexelHasASource, fixAlphaEdges } from './fixAlphaEdges';

/**
 * Get MIME type from file extension.
 */
export function getMimeType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'svg':
      return 'image/svg+xml';
    case 'webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Check if a path is a texture file.
 */
export function isTexturePath(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase();
  return ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'svg' || ext === 'webp';
}

/**
 * Create a THREE.Texture from binary data.
 * Uses blob URL for loading and properly cleans up.
 */
export async function createTextureFromBuffer(
  data: ArrayBuffer,
  mimeType: string,
  manager?: THREE.LoadingManager
): Promise<THREE.Texture> {
  const blob = new Blob([data], { type: mimeType });
  const blobUrl = URL.createObjectURL(blob);

  try {
    const loader = new THREE.TextureLoader(manager);
    const texture = await new Promise<THREE.Texture>((resolve, reject) => {
      loader.load(
        blobUrl,
        (loadedTexture: THREE.Texture) => {
          loadedTexture.colorSpace = THREE.SRGBColorSpace;
          resolve(loadedTexture);
        },
        undefined,
        () => {
          reject(new Error('Failed to decode texture'));
        }
      );
    });
    return applyAlphaBorderFix(texture);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * Whether every texel is either fully transparent or fully opaque.
 *
 * This decides whether the alpha-border pass may run at all, and the reason is
 * OUR readback rather than anything Godot does. Pixels come back through a 2D
 * canvas, whose backing store is premultiplied 8-bit: un-premultiplying
 * `rgb = stored / alpha` is exact at alpha 255 and carries no information at
 * all at alpha 0 (where this pass supplies the colour anyway), but at every
 * value between, the stored byte has already lost the low bits and the divide
 * amplifies what is left. A soft-edged image round-tripped that way comes back
 * visibly wrong.
 *
 * That would be a fair trade if the substitution were local, but it is not: the
 * pass replaces the whole image with a `DataTexture`, so every partially
 * transparent texel pays the round trip to repair the transparent ones. On a
 * radial light falloff — no opaque texel anywhere, three quarters of it partial
 * — that is a large net loss, measured against Godot.
 *
 * Binary alpha is exactly the case the pass exists for (a paletted sprite whose
 * transparent texels keep a leftover key colour), and exactly the case the
 * round trip carries losslessly.
 */
function hasOnlyBinaryAlpha(data: Uint8Array | Uint8ClampedArray): boolean {
  for (let i = 3; i < data.length; i += 4) {
    const alpha = data[i]!;
    if (alpha !== 0 && alpha !== 255) return false;
  }
  return true;
}

/**
 * Godot's import-time alpha-border pass (`fixAlphaEdges.ts`) applied to a
 * freshly decoded texture — the one step between the bytes on disk and the
 * bytes Godot's renderer samples that reading a `res://` image directly would
 * otherwise skip.
 *
 * Returns the SAME texture when nothing needs rewriting, so an image without
 * transparent texels keeps its decoded `HTMLImageElement` source and costs
 * nothing beyond one readback. Otherwise the fixed bytes come back as a
 * `DataTexture`: a canvas cannot carry them, because its backing store is
 * premultiplied and would zero the very RGB this pass just wrote behind alpha 0.
 *
 * `readPixels` is a seam, not API: happy-dom cannot rasterize, so injecting the
 * read is the only way a test reaches the image-backed branch. Production
 * passes one argument.
 */
export function applyAlphaBorderFix(
  texture: THREE.Texture,
  readPixels: (image: unknown) => ImagePixels | undefined = readImagePixels
): THREE.Texture {
  const pixels = readPixels(texture.image);
  if (!pixels) return texture;

  // The readback is only lossless at the two ends of the alpha range, and
  // substituting a DataTexture replaces the WHOLE image, not just the texels
  // this pass rewrites — so on an image carrying partial alpha the round trip
  // corrupts far more than the pass repairs. See `hasOnlyBinaryAlpha`.
  if (!hasOnlyBinaryAlpha(pixels.data)) return texture;

  // The other half of the same readback limitation: a transparent texel with no
  // opaque neighbour keeps its original RGB in Godot, and would come back black
  // here, because the premultiplied store zeroed it before this pass ever saw
  // it. Substituting is only faithful when the pass rewrites every one of them.
  if (!everyTransparentTexelHasASource(pixels.data, pixels.width, pixels.height)) return texture;

  // Copy rather than rewrite in place: a reader that hands back a texture's own
  // buffer (a DataTexture already carries one) would otherwise have this pass
  // mutate a cached resource, and the replacement below must own its pixels.
  const data = new Uint8Array(pixels.data);
  if (!fixAlphaEdges(data, pixels.width, pixels.height)) return texture;

  const fixed = new THREE.DataTexture(data, pixels.width, pixels.height, THREE.RGBAFormat);
  fixed.needsUpdate = true;
  fixed.colorSpace = texture.colorSpace;
  fixed.wrapS = texture.wrapS;
  fixed.wrapT = texture.wrapT;
  fixed.magFilter = texture.magFilter;
  fixed.minFilter = texture.minFilter;
  // A DataTexture defaults to no mipmaps, so a mipmapped minFilter alone would
  // leave every distance sampling level 0. Carry the decoded texture's intent.
  fixed.generateMipmaps = texture.generateMipmaps;
  fixed.anisotropy = texture.anisotropy;
  // The readback is top-row-first, the same orientation the decoded image
  // uploads in, so the loaded texture's own flip decides which way is up.
  fixed.flipY = texture.flipY;
  return fixed;
}

/**
 * Pure functions for texture processing.
 * Extracted from TextureLoader for use with createResourceProcessor.
 */

import * as THREE from 'three';
import { readImagePixels, type ImagePixels } from '../../r3f/controls/withImageCanvas';
import { fixAlphaEdges } from './fixAlphaEdges';

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
 * Pixels are read through a 2D canvas, so they arrive un-premultiplied from a
 * premultiplied store. A texel at or just above the alpha threshold is a
 * REPLACEMENT SOURCE whose RGB survives that round trip only to about ±6/255;
 * one at alpha 255, which is where nearly every replacement colour comes from,
 * is exact.
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

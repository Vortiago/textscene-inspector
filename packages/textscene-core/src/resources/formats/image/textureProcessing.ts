/** The image slice's texture decode, which `processors/createTextureProcessor.ts` calls. */

import * as THREE from 'three';
import { readImagePixels, type ImagePixels } from './imagePixels';
import { fixAlphaEdges } from '../../processing/fixAlphaEdges';
import { IMAGE_EXTENSIONS } from './extensions';
import { fileExtension } from '../../fileExtension';

export function getMimeType(path: string): string {
  switch (fileExtension(path)) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.svg':
      return 'image/svg+xml';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

export function isTexturePath(path: string): boolean {
  const extension = fileExtension(path);
  return extension !== null && IMAGE_EXTENSIONS.includes(extension);
}

/** Create a THREE.Texture from binary data through a blob URL, which it revokes. */
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
          // Wrapping stays at three's clamp-to-edge default. One entry is cached
          // per path and shared, and Godot gives it two opposite defaults:
          // `BaseMaterial3D` tiles (`FLAG_USE_TEXTURE_REPEAT`) and a `CanvasItem`
          // clamps. Each consumer states its own at bind time (ADR-0044).
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
 * Godot's import-time alpha-border pass (`fixAlphaEdges.ts`) on a decoded texture. It
 * returns the same texture when nothing needs rewriting, and otherwise a `DataTexture` of
 * the rewritten bytes, since a decoded image cannot be edited in place. `readPixels` is a
 * test seam, as happy-dom has no WebGL2: production passes one argument.
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

/** The image slice's texture decode, which `processors/createTextureProcessor.ts` calls. */

import * as THREE from 'three';
import { readImagePixels, type ImagePixels } from '../../../r3f/controls/withImageCanvas';
import { everyTransparentTexelHasASource, fixAlphaEdges } from '../../processing/fixAlphaEdges';

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

export function isTexturePath(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase();
  return ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'svg' || ext === 'webp';
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
          // Godot's BaseMaterial3D defaults FLAG_USE_TEXTURE_REPEAT to true, and
          // three's clamp-to-edge smears an edge texel wherever UVs leave 0..1. The
          // shared texture carries the shared default, and a material that authors
          // `texture_repeat = false` clones, like any other per-material state.
          loadedTexture.wrapS = THREE.RepeatWrapping;
          loadedTexture.wrapT = THREE.RepeatWrapping;
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
 * Whether every texel is fully transparent or fully opaque, the one case the readback
 * carries losslessly. The 2D canvas store is premultiplied 8-bit, so un-premultiplying
 * a partial alpha amplifies lost low bits. It is also the case the alpha-border pass
 * exists for: a paletted sprite whose transparent texels keep a key colour.
 */
function hasOnlyBinaryAlpha(data: Uint8Array | Uint8ClampedArray): boolean {
  for (let i = 3; i < data.length; i += 4) {
    const alpha = data[i]!;
    if (alpha !== 0 && alpha !== 255) return false;
  }
  return true;
}

/**
 * Godot's import-time alpha-border pass (`fixAlphaEdges.ts`) on a decoded texture. It
 * returns the same texture when nothing needs rewriting, and otherwise a `DataTexture`,
 * since a premultiplied canvas zeroes the RGB written behind alpha 0. `readPixels` is a
 * test seam, as happy-dom cannot rasterize: production passes one argument.
 */
export function applyAlphaBorderFix(
  texture: THREE.Texture,
  readPixels: (image: unknown) => ImagePixels | undefined = readImagePixels
): THREE.Texture {
  const pixels = readPixels(texture.image);
  if (!pixels) return texture;

  // A DataTexture replaces the whole image, not only the texels this pass rewrites,
  // so on partial alpha the lossy round trip corrupts more than the pass repairs.
  // On a radial light falloff, measured against Godot, it is a large net loss.
  if (!hasOnlyBinaryAlpha(pixels.data)) return texture;

  // A transparent texel with no opaque neighbour keeps its RGB in Godot, but the
  // premultiplied store zeroed it here. Substituting is faithful only when the pass
  // rewrites every transparent texel.
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

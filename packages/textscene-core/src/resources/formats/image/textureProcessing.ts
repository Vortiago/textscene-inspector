/** The image slice's texture decode, which `processors/createTextureProcessor.ts` calls. */

import * as THREE from 'three';
import { readImagePixels, type ImagePixels } from './imagePixels';
import { fixAlphaEdges } from '../../processing/fixAlphaEdges';
import { copySampling } from '../../textures/copySampling';
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

/** Create a THREE.Texture from binary data, with Godot's import alpha-border pass. */
export async function createTextureFromBuffer(
  data: ArrayBuffer,
  mimeType: string,
  manager?: THREE.LoadingManager
): Promise<THREE.Texture> {
  const texture = await decodeImage(data, mimeType, manager);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Wrapping stays at three's clamp-to-edge default. One entry is cached
  // per path and shared, and Godot gives it two opposite defaults:
  // `BaseMaterial3D` tiles (`FLAG_USE_TEXTURE_REPEAT`) and a `CanvasItem`
  // clamps. Each consumer states its own at bind time (ADR-0044).
  // A JPEG has no alpha, so the pass would read the image back to change nothing.
  return mimeType === 'image/jpeg' ? texture : applyAlphaBorderFix(texture);
}

/**
 * The RGBA8 pixels of image bytes, top row first, as Godot's layered importer reads its source:
 * with no alpha-border pass, which only the 2D importer runs.
 */
export async function decodeImagePixels(
  data: ArrayBuffer,
  mimeType: string,
  manager?: THREE.LoadingManager
): Promise<ImagePixels> {
  const texture = await decodeImage(data, mimeType, manager);
  const pixels = readImagePixels(texture.image);
  texture.dispose();
  if (!pixels) throw new Error(`Failed to read the pixels of a decoded ${mimeType} image`);
  return pixels;
}

/** Decodes image bytes through a blob URL, which it revokes. */
async function decodeImage(
  data: ArrayBuffer,
  mimeType: string,
  manager?: THREE.LoadingManager
): Promise<THREE.Texture> {
  const blob = new Blob([data], { type: mimeType });
  const blobUrl = URL.createObjectURL(blob);
  try {
    const loader = new THREE.TextureLoader(manager);
    return await new Promise<THREE.Texture>((resolve, reject) => {
      loader.load(blobUrl, resolve, undefined, () => {
        reject(new Error('Failed to decode texture'));
      });
    });
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * Godot's import-time alpha-border pass (`fixAlphaEdges.ts`) on a decoded texture. It
 * returns the same texture when nothing needs rewriting, and otherwise a `DataTexture` of
 * the rewritten bytes, since a decoded image cannot be edited in place.
 */
export function applyAlphaBorderFix(texture: THREE.Texture): THREE.Texture {
  const pixels = readImagePixels(texture.image);
  if (!pixels) return texture;

  // A DataTexture's own buffer is a cached resource that other consumers share, so the pass
  // edits a copy of it. A readback is already a fresh buffer.
  const isOwnBuffer = pixels.data === (texture.image as { data?: unknown }).data;
  const data =
    isOwnBuffer || !(pixels.data instanceof Uint8Array) ? new Uint8Array(pixels.data) : pixels.data;
  if (!fixAlphaEdges(data, pixels.width, pixels.height)) return texture;

  const fixed = copySampling(
    new THREE.DataTexture(data, pixels.width, pixels.height, THREE.RGBAFormat),
    texture
  );
  fixed.needsUpdate = true;
  fixed.colorSpace = texture.colorSpace;
  // The readback is top-row-first, the same orientation the decoded image
  // uploads in, so the loaded texture's own flip decides which way is up.
  fixed.flipY = texture.flipY;
  return fixed;
}

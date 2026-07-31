/**
 * Pure functions for texture processing.
 * Extracted from TextureLoader for use with createResourceProcessor.
 */

import * as THREE from 'three';

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
          // Godot's BaseMaterial3D constructs with FLAG_USE_TEXTURE_REPEAT =
          // true, so repeat is the DEFAULT every material inherits; three's
          // Texture defaults to clamp-to-edge, which smears one edge texel
          // across any surface whose UVs leave 0..1 (a terrain, a tiled road).
          // Set on the shared texture rather than per material precisely
          // because it IS the shared default — a material that authors
          // `texture_repeat = false` diverges and clones, like any other
          // per-material state.
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
    return texture;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

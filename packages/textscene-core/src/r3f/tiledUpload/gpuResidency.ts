/**
 * Which source-and-settings pairs three already has on the GPU. three keeps one GPU
 * texture per source and cache key (`WebGLTextures.getTextureCacheKey`), shared by every
 * clone that matches, and frees it when the last of those clones is disposed. A clone
 * that matches a resident pair draws without an upload, so the tiled upload skips it.
 */
import type * as THREE from 'three';

/** three's texture cache key, field for field, as three 0.186 builds it. */
export function residencyKey(texture: THREE.Texture): string {
  return [
    texture.wrapS,
    texture.wrapT,
    // `wrapR` exists only on 3D and array textures; three reads it as 0 elsewhere.
    (texture as { wrapR?: number }).wrapR || 0,
    texture.magFilter,
    texture.minFilter,
    texture.anisotropy,
    texture.internalFormat,
    texture.format,
    texture.type,
    texture.generateMipmaps,
    texture.premultiplyAlpha,
    texture.flipY,
    texture.unpackAlignment,
    texture.colorSpace,
  ].join();
}

export class GpuResidency {
  /** Written by `hold` and each held texture's dispose. A pair leaves at zero holders. */
  private readonly holders = new WeakMap<THREE.Texture['source'], Map<string, Set<THREE.Texture>>>();

  isResident(texture: THREE.Texture): boolean {
    return (this.holders.get(texture.source)?.get(residencyKey(texture))?.size ?? 0) > 0;
  }

  /** Counts `texture` as drawing its pair until it is disposed. */
  hold(texture: THREE.Texture): void {
    const key = residencyKey(texture);
    let byKey = this.holders.get(texture.source);
    if (!byKey) {
      byKey = new Map();
      this.holders.set(texture.source, byKey);
    }
    let textures = byKey.get(key);
    if (!textures) {
      textures = new Set();
      byKey.set(key, textures);
    }
    if (textures.has(texture)) return;
    textures.add(texture);
    const held = textures;
    texture.addEventListener('dispose', function release() {
      texture.removeEventListener('dispose', release);
      held.delete(texture);
      if (held.size === 0) byKey.delete(key);
    });
  }
}

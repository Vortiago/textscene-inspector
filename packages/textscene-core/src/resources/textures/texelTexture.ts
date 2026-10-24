/** A texture rebuilt from texels the CPU holds, with any mip chain the CPU built or the file stored. */

import * as THREE from 'three';
import { copySampling } from './copySampling';
import { godotTextureFilterState } from './godotTextureFilter';
import { mipChain, reversedLevel, type MipLevel } from '../processing/mipChain';
import { isBottomUp } from '../../utils/reversedRows';

/**
 * A `DataTexture` of `levels` that samples, tags and flips as `source`. Several levels are the
 * whole chain, so three uploads them as they stand and builds none. A single level asks the GPU
 * for a chain wherever `source` samples one. The caller keeps `source`.
 */
export function texelTexture(source: THREE.Texture, levels: MipLevel[]): THREE.DataTexture {
  const [base] = levels;
  if (!base) throw new Error('expected at least one level, got none');
  const texture = copySampling(
    new THREE.DataTexture(base.data, base.width, base.height, THREE.RGBAFormat),
    source
  );
  carryMipChain(texture, levels);
  texture.colorSpace = source.colorSpace;
  // The bytes keep the source's row order, so the source's flip decides which way is up.
  texture.flipY = source.flipY;
  texture.needsUpdate = true;
  return texture;
}

/** One level as a `DataTexture` uploads it: bytes, or half-float bits for a texture of half floats. */
export interface TextureLevel {
  data: Uint8Array | Uint16Array;
  width: number;
  height: number;
}

/**
 * Hands three the whole chain `levels` holds, so it uploads them as they stand and builds none.
 * One level is no chain: `texture` keeps its sampler and the GPU's choice. The first level holds
 * `texture`'s own bytes. Returns whether a chain was attached.
 */
function carryMipChain(texture: THREE.DataTexture, levels: TextureLevel[]): boolean {
  if (levels.length < 2) return false;
  texture.mipmaps = levels;
  texture.generateMipmaps = false;
  return true;
}

/**
 * {@link carryMipChain} for a texture no material has sampled yet: with a chain it also takes the
 * minification of Godot's default sampler (`LINEAR_WITH_MIPMAPS`, `material.h:573`), so the
 * levels are read between. A binding that authors `texture_filter` rewrites it.
 */
export function carryDefaultMipChain(texture: THREE.DataTexture, levels: TextureLevel[]): void {
  if (carryMipChain(texture, levels)) texture.minFilter = godotTextureFilterState(undefined).minFilter;
}

/**
 * `mipChain` of `base`, the bytes of `texture`, in Godot's top-down rows: an odd height drops the
 * bottom row as Godot sees it. Each level comes back in `texture`'s own row order, `base` first.
 */
export function textureMipChain(texture: THREE.Texture, base: MipLevel, renormalize: boolean): MipLevel[] {
  if (!isBottomUp(texture)) return mipChain(base, renormalize);
  const [, ...generated] = mipChain(reversedLevel(base), renormalize);
  return [base, ...generated.map(reversedLevel)];
}

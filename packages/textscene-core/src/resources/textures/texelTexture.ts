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
  carryMipChain(texture, levels, texture.minFilter);
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
 * The minification of Godot's default sampler (`LINEAR_WITH_MIPMAPS`, `material.h:573`), for a
 * texture no material has sampled yet. A binding that authors `texture_filter` rewrites it.
 */
export const GODOT_DEFAULT_MIN_FILTER = godotTextureFilterState(undefined).minFilter;

/**
 * The one way a texture takes a CPU mip chain: three uploads every level of `levels` as it stands
 * and builds none, and the texture minifies as `minFilter`, which reads the levels between. The
 * first level holds `texture`'s own bytes. One level is no chain, so `texture` keeps its sampler
 * and the GPU's choice.
 *
 * @canonical A `DataTexture` that carries a CPU mip chain
 */
export function carryMipChain(
  texture: THREE.DataTexture,
  levels: TextureLevel[],
  minFilter: THREE.MinificationTextureFilter
): void {
  if (levels.length < 2) return;
  texture.mipmaps = levels;
  texture.generateMipmaps = false;
  texture.minFilter = minFilter;
}

/**
 * `mipChain` of `base`, the bytes of `texture`, in Godot's top-down rows: an odd height drops the
 * bottom row as Godot sees it. Each level comes back in `texture`'s own row order, `base` first.
 *
 * @canonical A CPU mip chain as Godot builds it
 */
export function textureMipChain(texture: THREE.Texture, base: MipLevel, renormalize: boolean): MipLevel[] {
  if (!isBottomUp(texture)) return mipChain(base, renormalize);
  const [, ...generated] = mipChain(reversedLevel(base), renormalize);
  return [base, ...generated.map(reversedLevel)];
}

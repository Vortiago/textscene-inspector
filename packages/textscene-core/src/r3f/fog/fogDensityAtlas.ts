/**
 * The density textures of a view's FogVolumes, stacked in depth into one 3D texture. A WebGL2
 * shader indexes no sampler array in a loop, so the light pass samples each volume's region of it.
 */

import * as THREE from 'three';
import * as logger from '../../logger.js';
import { densityDataTexture3D } from '../../resources/textures/dataTexture3D.js';
import { MAX_3D_TEXTURE_EXTENT } from '../webglLimits.js';

/** Where a texture sits in the stack, in texels: its size, and its first slice. */
export interface FogDensityRegion {
  width: number;
  height: number;
  depth: number;
  zStart: number;
}

export class FogDensityAtlas {
  texture = densityDataTexture3D(new Uint8Array(1), 1, 1, 1, THREE.RedFormat);
  /** Written by `update`: the distinct textures the stack holds, in order. */
  private stacked: THREE.Data3DTexture[] = [];
  private readonly regions = new Map<THREE.Data3DTexture, FogDensityRegion>();

  /**
   * Stacks `textures` again when they are not the set the stack holds, and answers whether they
   * were not. The order does not count, so a volume added or removed elsewhere restacks nothing.
   */
  update(textures: readonly THREE.Data3DTexture[]): boolean {
    if (this.holdsExactly(textures)) return false;
    this.stacked = [...new Set(textures)];
    this.restack();
    return true;
  }

  /** The region `texture` holds, or nothing for a texture the stack left out. */
  regionOf(texture: THREE.Data3DTexture): FogDensityRegion | undefined {
    return this.regions.get(texture);
  }

  dispose(): void {
    this.texture.dispose();
  }

  /** Indexed, not `.every`: it runs on every render, so it allocates nothing. */
  private holdsExactly(textures: readonly THREE.Data3DTexture[]): boolean {
    for (let i = 0; i < textures.length; i++) {
      if (!this.stacked.includes(textures[i]!)) return false;
    }
    for (let i = 0; i < this.stacked.length; i++) {
      if (!textures.includes(this.stacked[i]!)) return false;
    }
    return true;
  }

  private restack(): void {
    this.regions.clear();
    let depth = 0;
    for (const texture of this.stacked) {
      const { width, height, depth: slices } = texture.image;
      if (depth + slices > MAX_3D_TEXTURE_EXTENT) {
        logger.warn(`[Fog] A density texture past ${MAX_3D_TEXTURE_EXTENT} stacked slices is not sampled`);
        continue;
      }
      this.regions.set(texture, { width, height, depth: slices, zStart: depth });
      depth += slices;
    }
    const regions = [...this.regions.values()];
    const width = Math.max(1, ...regions.map((region) => region.width));
    const height = Math.max(1, ...regions.map((region) => region.height));
    const data = new Uint8Array(width * height * Math.max(1, depth));
    for (const [texture, region] of this.regions) copyInto(data, width, height, texture, region);
    this.texture.dispose();
    this.texture = densityDataTexture3D(data, width, height, Math.max(1, depth), THREE.RedFormat);
  }
}

/**
 * Copies the red channel of each row of `texture` into its region of the stack, whose rows are
 * `width` texels long. A density reads only red (`scene/resources/3d/fog_material.cpp:160`).
 */
function copyInto(
  data: Uint8Array,
  width: number,
  height: number,
  texture: THREE.Data3DTexture,
  region: FogDensityRegion
): void {
  const texels = texture.image.data as Uint8Array;
  const stride = texture.format === THREE.RedFormat ? 1 : 4;
  for (let z = 0; z < region.depth; z++) {
    for (let y = 0; y < region.height; y++) {
      const source = (z * region.height + y) * region.width;
      const target = ((region.zStart + z) * height + y) * width;
      for (let x = 0; x < region.width; x++) data[target + x] = texels[(source + x) * stride]!;
    }
  }
}

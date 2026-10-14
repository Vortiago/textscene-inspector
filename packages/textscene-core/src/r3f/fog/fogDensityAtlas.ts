/**
 * The density textures of the drawn FogVolumes, stacked in depth into one 3D texture. A WebGL2
 * shader indexes no sampler array in a loop, so the light pass samples each volume's region of it.
 */

import * as THREE from 'three';
import * as logger from '../../logger.js';
import { MAX_3D_TEXTURE_EXTENT } from '../webglLimits.js';

/** Where a texture sits in the stack, in texels: its size, and its first slice. */
export interface FogDensityRegion {
  width: number;
  height: number;
  depth: number;
  zStart: number;
}

export class FogDensityAtlas {
  texture = stackTexture(new Uint8Array(1), 1, 1, 1);
  /** Counts the stacks, so each view knows whether its last draw read this one. */
  version = 0;
  /** Written by `update`: the textures the stack holds, in order. */
  private stacked: THREE.Data3DTexture[] = [];
  private readonly regions = new Map<THREE.Data3DTexture, FogDensityRegion>();

  /** Stacks `textures` again when they differ from the stack's, and answers whether they did. */
  update(textures: readonly THREE.Data3DTexture[]): boolean {
    const distinct = [...new Set(textures)];
    if (
      distinct.length === this.stacked.length &&
      distinct.every((texture, i) => texture === this.stacked[i])
    ) {
      return false;
    }
    this.stacked = distinct;
    this.restack();
    this.version++;
    return true;
  }

  /** The region `texture` holds, or nothing for a texture the stack left out. */
  regionOf(texture: THREE.Data3DTexture): FogDensityRegion | undefined {
    return this.regions.get(texture);
  }

  dispose(): void {
    this.texture.dispose();
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
    this.texture = stackTexture(data, width, height, Math.max(1, depth));
  }
}

/** Copies each row of `texture` into its region of the stack, whose rows are `width` texels long. */
function copyInto(
  data: Uint8Array,
  width: number,
  height: number,
  texture: THREE.Data3DTexture,
  region: FogDensityRegion
): void {
  const texels = texture.image.data as Uint8Array;
  for (let z = 0; z < region.depth; z++) {
    for (let y = 0; y < region.height; y++) {
      const source = (z * region.height + y) * region.width;
      data.set(texels.subarray(source, source + region.width), ((region.zStart + z) * height + y) * width);
    }
  }
}

/** Sampled linearly, as Godot samples a density texture (`environment/fog.cpp:259-260`). */
function stackTexture(data: Uint8Array, width: number, height: number, depth: number): THREE.Data3DTexture {
  const texture = new THREE.Data3DTexture(data, width, height, depth);
  texture.format = THREE.RedFormat;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}

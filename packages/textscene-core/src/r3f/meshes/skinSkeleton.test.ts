/**
 * Whether the bones of a mesh reach past its skin: Godot draws nothing of a mesh whose every surface
 * addresses more bones than the skin binds (`mesh_storage.cpp:729-730`).
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { godotSurfacesGeometry } from '../../resources/meshes/godotSurface';
import { isOutgrownBySkin } from './skinSkeleton';

/**
 * A skinned surface of one triangle and one vertex that no triangle draws. `highest` is the highest
 * bone index of the triangle, and `unusedHighest` that of the vertex no triangle draws.
 */
function skinnedSurface(highest: number, unusedHighest = 0) {
  const bones = new Uint16Array(16);
  bones[0] = highest;
  bones[12] = unusedHighest;
  return {
    positions: new Float32Array(12),
    bones: { indices: bones, weights: new Float32Array(16) },
    indices: [0, 1, 2],
  };
}

describe('isOutgrownBySkin', () => {
  it('is false while the skin binds every bone the surface addresses', () => {
    expect(isOutgrownBySkin(godotSurfacesGeometry([skinnedSurface(2)]), 3)).toBe(false);
  });

  it('is true when the surface addresses a bone past the last bind', () => {
    expect(isOutgrownBySkin(godotSurfacesGeometry([skinnedSurface(3)]), 3)).toBe(true);
  });

  it('counts a vertex that no triangle draws, as Godot counts the whole surface array', () => {
    expect(isOutgrownBySkin(godotSurfacesGeometry([skinnedSurface(0, 5)]), 3)).toBe(true);
  });

  it('is false for a skin with no bind, whose vertices collapse instead (mesh_storage.cpp:716)', () => {
    expect(isOutgrownBySkin(godotSurfacesGeometry([skinnedSurface(5)]), 0)).toBe(false);
  });

  it('is false where the geometry has no bone arrays', () => {
    expect(isOutgrownBySkin(new THREE.BoxGeometry(), 1)).toBe(false);
    expect(isOutgrownBySkin(undefined, 1)).toBe(false);
  });

  it('is false while one surface still fits the skin, which keeps the instance bounds', () => {
    const geometry = godotSurfacesGeometry([skinnedSurface(5), skinnedSurface(1)]);

    expect(isOutgrownBySkin(geometry, 3)).toBe(false);
  });

  it('is true when every surface reaches past the skin', () => {
    const geometry = godotSurfacesGeometry([skinnedSurface(5), skinnedSurface(4)]);

    expect(isOutgrownBySkin(geometry, 3)).toBe(true);
  });
});

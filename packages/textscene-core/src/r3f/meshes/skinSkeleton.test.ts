/**
 * Whether the bones of a mesh reach past its skin: Godot draws nothing of a mesh whose every surface
 * addresses more bones than the skin binds (`mesh_storage.cpp:729-730`).
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { isOutgrownBySkin } from './skinSkeleton';

/**
 * Triangles of the given surfaces, one vertex each: `surfaces[i]` is the highest bone index the
 * vertices of surface `i` address. Every other slot of a vertex addresses bone 0.
 */
function geometryOf(...surfaces: number[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const vertexCount = surfaces.length * 3;
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3));
  const skinIndices = new Float32Array(vertexCount * 4);
  surfaces.forEach((highest, surface) => {
    skinIndices[surface * 12] = highest;
    geometry.addGroup(surface * 3, 3, surface);
  });
  geometry.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndices, 4));
  geometry.setIndex(Array.from({ length: vertexCount }, (_unused, i) => i));
  return geometry;
}

describe('isOutgrownBySkin', () => {
  it('is false while the skin binds every bone the surface addresses', () => {
    expect(isOutgrownBySkin(geometryOf(2), 3)).toBe(false);
  });

  it('is true when the surface addresses a bone past the last bind', () => {
    expect(isOutgrownBySkin(geometryOf(3), 3)).toBe(true);
  });

  it('is false for a skin with no bind, whose vertices collapse instead (mesh_storage.cpp:716)', () => {
    expect(isOutgrownBySkin(geometryOf(5), 0)).toBe(false);
  });

  it('is false where the geometry has no bone arrays', () => {
    expect(isOutgrownBySkin(new THREE.BoxGeometry(), 1)).toBe(false);
    expect(isOutgrownBySkin(undefined, 1)).toBe(false);
  });

  it('is false while one surface still fits the skin, which keeps the instance bounds', () => {
    expect(isOutgrownBySkin(geometryOf(5, 1), 3)).toBe(false);
  });

  it('is true when every surface reaches past the skin', () => {
    expect(isOutgrownBySkin(geometryOf(5, 4), 3)).toBe(true);
  });

  it('counts the surfaces of a geometry with no groups as one', () => {
    const geometry = geometryOf(5);
    geometry.clearGroups();

    expect(isOutgrownBySkin(geometry, 3)).toBe(true);
  });
});

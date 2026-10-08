import { describe, expect, it } from 'vitest';
import { EMPTY_AABB } from '../../../godot/aabb';
import { primitiveMeshAabb } from './primitiveMeshGeometry';

describe('primitiveMeshAabb', () => {
  it('bounds the vertices a BoxMesh builds', () => {
    const aabb = primitiveMeshAabb({ id: 'box', type: 'BoxMesh', data: { size: 'Vector3(2, 4, 6)' } });
    expect(aabb).toEqual({ position: { x: -1, y: -2, z: -3 }, size: { x: 2, y: 4, z: 6 } });
  });

  it('takes a custom box over the vertices', () => {
    const data = { custom_aabb: 'AABB(-5, -5, -5, 10, 10, 10)' };
    expect(primitiveMeshAabb({ id: 'box', type: 'BoxMesh', data })?.size).toEqual({ x: 10, y: 10, z: 10 });
  });

  it('is AABB() for a mesh Godot builds no surface for', () => {
    const data = { inner_radius: '1.0', outer_radius: '1.0' };
    expect(primitiveMeshAabb({ id: 'torus', type: 'TorusMesh', data })).toBe(EMPTY_AABB);
  });

  it('is unknown for a type with no slice here', () => {
    expect(primitiveMeshAabb({ id: 'text', type: 'TextMesh', data: {} })).toBeNull();
  });
});

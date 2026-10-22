/** PointMesh build: one vertex at the origin, as a points surface (`primitive_meshes.cpp:2379-2389`). */
import { describe, expect, it } from 'vitest';
import { primitiveMeshSurface } from '../primitivemesh/surface';
import { scopedMesh } from '../primitivemesh/surface.testkit';

const TEXEL_SIZE = 0.2;

function pointMeshSurface(data: Record<string, string> = {}) {
  return primitiveMeshSurface(scopedMesh({ id: 'P', type: 'PointMesh', data }), TEXEL_SIZE);
}

describe('PointMesh surface', () => {
  it('builds one vertex at the origin', () => {
    expect(Array.from(pointMeshSurface()!.positions)).toEqual([0, 0, 0]);
  });

  it('is a points surface that draws its one vertex', () => {
    const surface = pointMeshSurface()!;
    expect(surface.isPoints).toBe(true);
    expect(Array.from(surface.indices)).toEqual([0]);
  });

  it('writes no normal, tangent or UV, as Godot writes only ARRAY_VERTEX', () => {
    const surface = pointMeshSurface()!;
    expect(surface.normals).toBeUndefined();
    expect(surface.tangents).toBeUndefined();
    expect(surface.uvs).toBeUndefined();
  });

  it('adds no UV2 for add_uv2, as Godot has no UV to scale', () => {
    expect(pointMeshSurface({ add_uv2: 'true' })!.uv2s).toBeUndefined();
  });

  it('is left as it is by flip_faces, which Godot applies to a mesh with normals and indices', () => {
    expect(Array.from(pointMeshSurface({ flip_faces: 'true' })!.positions)).toEqual([0, 0, 0]);
  });
});

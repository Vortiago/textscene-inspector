/**
 * arrayMeshGeometry — turns decoded ArrayMesh surfaces into a single
 * THREE.BufferGeometry (one group per surface so each can take its own
 * material). Tested against the byte-exact wall.tres decode.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { decodeArrayMesh, type ArrayMeshData } from './arrayMeshDecode';
import { buildArrayMeshGeometry } from './arrayMeshGeometry';

const WALL_TRES = `[gd_resource type="ArrayMesh" format=4 uid="uid://bett1yahcwe25"]

[ext_resource type="Material" path="res://stage/tile_material.tres" id="1_a5mma"]

[resource]
_surfaces = [{
"aabb": AABB(-1, -1, 1, 2, 2, 1.001358e-05),
"attribute_data": PackedByteArray("AAAAAAAAgD4AAIA+AACAPgAAgD4AAAAAAAAAAAAAAAA="),
"format": 34359742487,
"index_count": 6,
"index_data": PackedByteArray("AgAAAAMAAgABAAAA"),
"material": ExtResource("1_a5mma"),
"primitive": 3,
"uv_scale": Vector4(0, 0, 0, 0),
"vertex_count": 4,
"vertex_data": PackedByteArray("AACAvwAAgL8AAIA/AACAPwAAgL8AAIA/AACAPwAAgD8AAIA/AACAvwAAgD8AAIA//3//f////7//f/9/////v/9//3////+//3//f////78=")
}]
blend_shape_mode = 0
`;

describe('buildArrayMeshGeometry', () => {
  it('builds a BufferGeometry with position, uv, index and Godot normals', () => {
    const geo = buildArrayMeshGeometry(decodeArrayMesh(WALL_TRES));

    expect(geo).toBeInstanceOf(THREE.BufferGeometry);
    expect(geo.getAttribute('position').count).toBe(4);
    expect(geo.getAttribute('uv').count).toBe(4);
    expect(geo.getIndex()!.count).toBe(6);
    // Godot's decoded per-vertex normals flow through: the planar quad → +Z.
    const normal = geo.getAttribute('normal');
    expect(normal.count).toBe(4);
    expect(normal.getZ(0)).toBeCloseTo(1, 3);
  });

  it('falls back to computeVertexNormals when a surface has no decoded normals', () => {
    const data: ArrayMeshData = {
      surfaces: [
        {
          format: 0, // no NORMAL bit → surface.normals undefined
          primitive: 3,
          vertexCount: 3,
          indexCount: 3,
          // Godot-style CW winding from +Z; the builder reverses it to CCW so
          // computeVertexNormals() yields the outward +Z normal.
          positions: new Float32Array([0, 0, 0, 0, 1, 0, 1, 0, 0]),
          indices: new Uint16Array([0, 1, 2]),
        },
      ],
    };
    const geo = buildArrayMeshGeometry(data);
    expect(geo.getAttribute('normal').count).toBe(3);
    expect(geo.getAttribute('normal').getZ(0)).toBeCloseTo(1, 3);
  });

  it('adds one draw group per surface for per-surface materials', () => {
    const geo = buildArrayMeshGeometry(decodeArrayMesh(WALL_TRES));

    expect(geo.groups).toHaveLength(1);
    expect(geo.groups[0]).toMatchObject({ start: 0, count: 6, materialIndex: 0 });
  });

  it('merges multiple surfaces, re-basing each surface\'s indices and grouping them', () => {
    const surface = (mat: string) => ({
      format: 0,
      primitive: 3,
      vertexCount: 3,
      indexCount: 3,
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      uvs: new Float32Array([0, 0, 1, 0, 0, 1]),
      indices: new Uint16Array([0, 1, 2]),
      materialPath: mat,
    });
    const data: ArrayMeshData = { surfaces: [surface('res://a.tres'), surface('res://b.tres')] };

    const geo = buildArrayMeshGeometry(data);

    expect(geo.getAttribute('position').count).toBe(6);
    expect(geo.groups).toHaveLength(2);
    expect(geo.groups[1]).toMatchObject({ start: 3, count: 3, materialIndex: 1 });
    // Surface 1's indices [0,1,2] are re-based by +3 AND winding-reversed
    // (Godot CW → three.js CCW), so [0,1,2] → [3, 5, 4] in the merged buffer.
    expect(Array.from(geo.getIndex()!.array).slice(3)).toEqual([3, 5, 4]);
  });
});

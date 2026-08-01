/**
 * arrayMeshGeometry — turns decoded ArrayMesh surfaces into a single
 * THREE.BufferGeometry (one group per surface so each can take its own
 * material). Tested against the byte-exact wall.tres decode.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { decodeArrayMesh } from './decode';
import type { ArrayMeshData } from './types';
import { buildArrayMeshGeometry } from './build';

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

/**
 * The wall quad (uncompressed) followed by truck_cab.tres's `headlights` surface
 * (ARRAY_FLAG_COMPRESS_ATTRIBUTES). Godot writes both layouts into one mesh, and
 * every surface merges into one geometry — so a surface read at the wrong stride
 * does not merely draw wrong, it takes the merged bounds down with it.
 */
const MIXED_LAYOUT_TRES = WALL_TRES.replace(
  '}]\nblend_shape_mode = 0',
  `}, {
"aabb": AABB(0.416992, 0.114807, 1.339844, 0.102539, 0.06988499, 0.023437023),
"format": 34896613383,
"index_count": 6,
"index_data": PackedByteArray("AAABAAIAAAADAAEA"),
"name": "headlights",
"primitive": 3,
"uv_scale": Vector4(0, 0, 0, 0),
"vertex_count": 4,
"vertex_data": PackedByteArray("//8B71UVpsQAAEkKqeqmxC4l//8AAKbEj/0AAP//psTYje2P2I3tj9iN7Y/Yje2P")
}]
blend_shape_mode = 0`
);

/** The single-triangle surface these tests vary one field of at a time. */
function triangle(overrides: Partial<ArrayMeshData['surfaces'][number]> = {}) {
  return {
    format: 0,
    primitive: 3,
    vertexCount: 3,
    indexCount: 3,
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    uvs: new Float32Array([0, 0, 1, 0, 0, 1]),
    indices: new Uint16Array([0, 1, 2]),
    materialPath: 'res://a.tres',
    ...overrides,
  };
}

describe('buildArrayMeshGeometry', () => {
  it('builds a BufferGeometry with position, uv, index and Godot normals', () => {
    const geo = buildArrayMeshGeometry(decodeArrayMesh(WALL_TRES, 'res://mesh.tres'));

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

  it("flips V so Godot's top-left-origin UVs match the app's flipY=true textures", () => {
    // Godot writes V from the image TOP; three.js uploads textures bottom-up by
    // default (the convention spriteFrame.ts / tileGeometry.ts also target), so
    // a pass-through V samples an atlas mirrored — the whole texture reads off
    // by one row. V=0 (Godot's top edge) must become V=1 here.
    const uv = buildArrayMeshGeometry({
      surfaces: [triangle({ uvs: new Float32Array([0, 0, 1, 0.25, 0.5, 1]) })],
    }).getAttribute('uv');

    // U is untouched; only V is mirrored.
    expect([uv.getX(0), uv.getY(0)]).toEqual([0, 1]);
    expect([uv.getX(1), uv.getY(1)]).toEqual([1, 0.75]);
    expect([uv.getX(2), uv.getY(2)]).toEqual([0.5, 0]);
  });

  it('converts a UV-less surface too, so one geometry never holds two V spaces', () => {
    // Godot allows per-surface vertex formats: only some surfaces may declare
    // TEX_UV. `hasUV` is `some`, so the merged buffer covers the UV-less ones
    // as zeros — and Godot samples those at UV (0,0), the image TOP, which is
    // V=1 here. Leaving them at 0 would point them at the opposite edge from
    // their textured neighbours.
    const uv = buildArrayMeshGeometry({
      surfaces: [triangle(), triangle({ uvs: undefined })],
    }).getAttribute('uv');

    expect(uv.getY(0)).toBe(1); // written 0 → image top
    expect(uv.getY(3)).toBe(1); // unwritten 0 → same edge, not the opposite one
    expect(uv.getY(4)).toBe(1);
  });

  it('adds one draw group per surface for per-surface materials', () => {
    const geo = buildArrayMeshGeometry(decodeArrayMesh(WALL_TRES, 'res://mesh.tres'));

    expect(geo.groups).toHaveLength(1);
    expect(geo.groups[0]).toMatchObject({ start: 0, count: 6, materialIndex: 0 });
  });

  it('computes a finite bounding sphere for a mesh mixing compressed and uncompressed surfaces', () => {
    // Reading a compressed surface at the uncompressed stride produced NaN
    // positions, and THREE reported "computeBoundingSphere(): Computed radius is
    // NaN" for the whole geometry — which also left the camera unable to frame it.
    const geo = buildArrayMeshGeometry(decodeArrayMesh(MIXED_LAYOUT_TRES, 'res://mesh.tres'));

    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    expect(Number.isFinite(geo.boundingSphere!.radius)).toBe(true);
    expect(geo.boundingSphere!.radius).toBeGreaterThan(0);
    for (const v of [geo.boundingBox!.min, geo.boundingBox!.max]) {
      expect([v.x, v.y, v.z].every(Number.isFinite)).toBe(true);
    }
    expect(geo.groups).toHaveLength(2);
  });

  it('merges multiple surfaces, re-basing each surface\'s indices and grouping them', () => {
    const data: ArrayMeshData = {
      surfaces: [triangle(), triangle({ materialPath: 'res://b.tres' })],
    };

    const geo = buildArrayMeshGeometry(data);

    expect(geo.getAttribute('position').count).toBe(6);
    expect(geo.groups).toHaveLength(2);
    expect(geo.groups[1]).toMatchObject({ start: 3, count: 3, materialIndex: 1 });
    // Surface 1's indices [0,1,2] are re-based by +3 AND winding-reversed
    // (Godot CW → three.js CCW), so [0,1,2] → [3, 5, 4] in the merged buffer.
    expect(Array.from(geo.getIndex()!.array).slice(3)).toEqual([3, 5, 4]);
    // The V flip must follow surface 1 to its offset, not stop at surface 0:
    // a flip that forgot `vertexBase` passes the single-surface test above.
    const uv = geo.getAttribute('uv');
    expect(uv.getY(3)).toBe(1);
    expect(uv.getY(5)).toBe(0);
  });
});

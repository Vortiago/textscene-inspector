/**
 * arrayMeshDecode — decodes a Godot 4 text ArrayMesh (.tres, format=4) into
 * per-surface typed arrays a THREE.BufferGeometry can consume. The fixtures
 * here are byte-exact copies of real converted demo meshes so the decoder is
 * tested against the actual on-disk layout (base64 PackedByteArray + the
 * uint64 vertex `format` bitfield), not an idealized stand-in.
 */
import { describe, it, expect } from 'vitest';
import { decodeArrayMesh } from './arrayMeshDecode';

/**
 * scenes/demos/3d/platformer/stage/meshes/wall.tres — a 4-vertex quad, one
 * surface, one material. format 34359742487 = VERTEX|NORMAL|TANGENT|TEX_UV|INDEX,
 * uncompressed (no ARRAY_FLAG_COMPRESS_ATTRIBUTES). vertex 0 = (-1,-1,1).
 */
const WALL_TRES = `[gd_resource type="ArrayMesh" format=4 uid="uid://bett1yahcwe25"]

[ext_resource type="Material" path="res://stage/tile_material.tres" id="1_a5mma"]

[resource]
resource_name = "tiles_wall"
_surfaces = [{
"aabb": AABB(-1, -1, 1, 2, 2, 1.001358e-05),
"attribute_data": PackedByteArray("AAAAAAAAgD4AAIA+AACAPgAAgD4AAAAAAAAAAAAAAAA="),
"format": 34359742487,
"index_count": 6,
"index_data": PackedByteArray("AgAAAAMAAgABAAAA"),
"material": ExtResource("1_a5mma"),
"name": "tile_material",
"primitive": 3,
"uv_scale": Vector4(0, 0, 0, 0),
"vertex_count": 4,
"vertex_data": PackedByteArray("AACAvwAAgL8AAIA/AACAPwAAgL8AAIA/AACAPwAAgD8AAIA/AACAvwAAgD8AAIA//3//f////7//f/9/////v/9//3////+//3//f////78=")
}]
blend_shape_mode = 0
`;

describe('decodeArrayMesh', () => {
  it('parses surface metadata (count, format, primitive, vertex/index counts)', () => {
    const mesh = decodeArrayMesh(WALL_TRES);

    expect(mesh.surfaces).toHaveLength(1);
    const surface = mesh.surfaces[0];
    expect(surface.format).toBe(34359742487);
    expect(surface.primitive).toBe(3);
    expect(surface.vertexCount).toBe(4);
    expect(surface.indexCount).toBe(6);
  });

  it('decodes vertex positions (3×float32, first in the vertex stride)', () => {
    const surface = decodeArrayMesh(WALL_TRES).surfaces[0];

    expect(surface.positions).toHaveLength(4 * 3);
    // Vertex 0 = (-1, -1, 1) per the surface AABB(-1,-1,1, 2,2,~0).
    expect(surface.positions[0]).toBeCloseTo(-1, 4);
    expect(surface.positions[1]).toBeCloseTo(-1, 4);
    expect(surface.positions[2]).toBeCloseTo(1, 4);
    // Every vertex lies within the AABB: x,y ∈ [-1,1], z ≈ 1.
    for (let i = 0; i < 4; i++) {
      expect(surface.positions[i * 3 + 0]).toBeGreaterThanOrEqual(-1.001);
      expect(surface.positions[i * 3 + 0]).toBeLessThanOrEqual(1.001);
      expect(surface.positions[i * 3 + 2]).toBeCloseTo(1, 2);
    }
  });

  it('decodes indices with byte-width auto-detection (uint16 here)', () => {
    const surface = decodeArrayMesh(WALL_TRES).surfaces[0];

    expect(surface.indices).toBeInstanceOf(Uint16Array);
    expect(Array.from(surface.indices)).toEqual([2, 0, 3, 2, 1, 0]);
  });

  it('decodes UV1 from attribute_data when TEX_UV is present (2×float32)', () => {
    const surface = decodeArrayMesh(WALL_TRES).surfaces[0];

    expect(surface.uvs).toBeDefined();
    expect(surface.uvs).toHaveLength(4 * 2);
    for (const v of surface.uvs!) expect(Number.isFinite(v)).toBe(true);
  });

  it('decodes Godot packed octahedral normals (wall quad faces +Z)', () => {
    const surface = decodeArrayMesh(WALL_TRES).surfaces[0];

    expect(surface.normals).toBeDefined();
    expect(surface.normals).toHaveLength(4 * 3);
    for (let i = 0; i < 4; i++) {
      const nx = surface.normals![i * 3 + 0];
      const ny = surface.normals![i * 3 + 1];
      const nz = surface.normals![i * 3 + 2];
      // unit length
      expect(Math.hypot(nx, ny, nz)).toBeCloseTo(1, 3);
      // planar quad in the XY plane at z=1 → normal (0, 0, 1)
      expect(nx).toBeCloseTo(0, 2);
      expect(ny).toBeCloseTo(0, 2);
      expect(nz).toBeCloseTo(1, 2);
    }
  });

  it("resolves each surface's material to its res:// path via the file's ext_resources", () => {
    const surface = decodeArrayMesh(WALL_TRES).surfaces[0];
    // "material": ExtResource("1_a5mma") → the [ext_resource] with that id.
    expect(surface.materialPath).toBe('res://stage/tile_material.tres');
  });

  it('decodes multiple surfaces with per-surface groups-worth of data and materials', () => {
    const mesh = decodeArrayMesh(TWO_SURFACE_TRES);
    expect(mesh.surfaces).toHaveLength(2);
    expect(mesh.surfaces[0].materialPath).toBe('res://a.tres');
    expect(mesh.surfaces[1].materialPath).toBe('res://b.tres');
    expect(mesh.surfaces[0].vertexCount).toBe(4);
    expect(mesh.surfaces[1].vertexCount).toBe(4);
  });
});

/** Two surfaces (the wall quad twice) with distinct materials a/b. */
const TWO_SURFACE_TRES = `[gd_resource type="ArrayMesh" format=4 uid="uid://two"]

[ext_resource type="Material" path="res://a.tres" id="1_a"]
[ext_resource type="Material" path="res://b.tres" id="2_b"]

[resource]
_surfaces = [{
"attribute_data": PackedByteArray("AAAAAAAAgD4AAIA+AACAPgAAgD8AAAAAAABAPwAAAAA="),
"format": 34359742487,
"index_count": 6,
"index_data": PackedByteArray("AgAAAAMAAgABAAAA"),
"material": ExtResource("1_a"),
"primitive": 3,
"vertex_count": 4,
"vertex_data": PackedByteArray("AACAvwAAgL8AAIA/AACAPwAAgL8AAIA/AACAPwAAgD8AAIA/AACAvwAAgD8AAIA//3//f////7//f/9/////v/9//3////+//3//f////78=")
}, {
"attribute_data": PackedByteArray("AAAAAAAAgD4AAIA+AACAPgAAgD8AAAAAAABAPwAAAAA="),
"format": 34359742487,
"index_count": 6,
"index_data": PackedByteArray("AgAAAAMAAgABAAAA"),
"material": ExtResource("2_b"),
"primitive": 3,
"vertex_count": 4,
"vertex_data": PackedByteArray("AACAvwAAgL8AAIA/AACAPwAAgL8AAIA/AACAPwAAgD8AAIA/AACAvwAAgD8AAIA//3//f////7//f/9/////v/9//3////+//3//f////78=")
}]
blend_shape_mode = 0
`;

const COLOR_UV_TRES = `[gd_resource type="ArrayMesh" format=4]

[resource]
_surfaces = [{
"aabb": AABB(0, 0, 0, 1, 1, 0),
"attribute_data": PackedByteArray("/wAA/wAAgD4AAAA/AP8A/wAAQD8AAIA/"),
"format": 4121,
"index_count": 0,
"primitive": 3,
"vertex_count": 2,
"vertex_data": PackedByteArray("AAAAAAAAAAAAAAAAAACAPwAAgD8AAAAA")
}]
`;

describe('attribute_data layout', () => {
  it('reads UV1 past the vertex colour instead of decoding the colour as u', () => {
    // Godot orders the attribute record COLOR, UV1, UV2 — a surface with vertex
    // colours puts 4 RGBA8 bytes ahead of UV1, so reading from offset 0 decodes
    // the colour as `u`. Real case: the COLOR+TEX_UV surface of
    // demos/3d/material_testers/models/godot_ball.tres (12-byte record).
    const surface = decodeArrayMesh(COLOR_UV_TRES).surfaces[0]!;

    expect(Array.from(surface.uvs!)).toEqual([0.25, 0.5, 0.75, 1]);
  });

  it('emits no UVs for a compressed-attribute surface rather than garbage floats', () => {
    // uint16-quantised UVs scaled by uv_scale are not decoded; reading them as
    // float32 produced values like 6.7e37 (docs/PARITY-LIMITATIONS.md).
    const compressed = COLOR_UV_TRES.replace('"format": 4121', '"format": 536875025');

    expect(decodeArrayMesh(compressed).surfaces[0]!.uvs).toBeUndefined();
  });
});

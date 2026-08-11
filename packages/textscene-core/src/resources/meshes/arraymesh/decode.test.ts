/**
 * The ArrayMesh slice decode — decodes a Godot 4 text ArrayMesh (.tres, format=4) into
 * per-surface typed arrays a THREE.BufferGeometry can consume. The fixtures
 * here are byte-exact copies of real converted demo meshes so the decoder is
 * tested against the actual on-disk layout (base64 PackedByteArray + the
 * uint64 vertex `format` bitfield), not an idealized stand-in.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as logger from '../../../logger';
import { decodeArrayMesh } from './decode';

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

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
  it('parses surface metadata (count, format, vertex/index counts)', () => {
    const mesh = decodeArrayMesh(WALL_TRES, 'res://mesh.tres');

    expect(mesh.surfaces).toHaveLength(1);
    const surface = mesh.surfaces[0]!;
    expect(surface.format).toBe(34359742487);
    expect(surface.vertexCount).toBe(4);
    expect(surface.indexCount).toBe(6);
  });

  it('decodes vertex positions (3×float32, first in the vertex stride)', () => {
    const surface = decodeArrayMesh(WALL_TRES, 'res://mesh.tres').surfaces[0]!;

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
    const surface = decodeArrayMesh(WALL_TRES, 'res://mesh.tres').surfaces[0]!;

    expect(surface.indices).toBeInstanceOf(Uint16Array);
    expect(Array.from(surface.indices)).toEqual([2, 0, 3, 2, 1, 0]);
  });

  it('decodes UV1 from attribute_data when TEX_UV is present (2×float32)', () => {
    const surface = decodeArrayMesh(WALL_TRES, 'res://mesh.tres').surfaces[0]!;

    expect(surface.uvs).toBeDefined();
    expect(surface.uvs).toHaveLength(4 * 2);
    for (const v of surface.uvs!) expect(Number.isFinite(v)).toBe(true);
  });

  it('decodes Godot packed octahedral normals (wall quad faces +Z)', () => {
    const surface = decodeArrayMesh(WALL_TRES, 'res://mesh.tres').surfaces[0]!;

    expect(surface.normals).toBeDefined();
    expect(surface.normals).toHaveLength(4 * 3);
    for (let i = 0; i < 4; i++) {
      const nx = surface.normals![i * 3 + 0]!;
      const ny = surface.normals![i * 3 + 1]!;
      const nz = surface.normals![i * 3 + 2]!;
      // unit length
      expect(Math.hypot(nx, ny, nz)).toBeCloseTo(1, 3);
      // planar quad in the XY plane at z=1 → normal (0, 0, 1)
      expect(nx).toBeCloseTo(0, 2);
      expect(ny).toBeCloseTo(0, 2);
      expect(nz).toBeCloseTo(1, 2);
    }
  });

  it("resolves each surface's material to its res:// path via the file's ext_resources", () => {
    const surface = decodeArrayMesh(WALL_TRES, 'res://mesh.tres').surfaces[0]!;
    // "material": ExtResource("1_a5mma") → the [ext_resource] with that id.
    expect(surface.materialPath).toBe('res://stage/tile_material.tres');
  });

  it('decodes multiple surfaces with per-surface groups-worth of data and materials', () => {
    const mesh = decodeArrayMesh(TWO_SURFACE_TRES, 'res://mesh.tres');
    expect(mesh.surfaces).toHaveLength(2);
    expect(mesh.surfaces[0]!.materialPath).toBe('res://a.tres');
    expect(mesh.surfaces[1]!.materialPath).toBe('res://b.tres');
    expect(mesh.surfaces[0]!.vertexCount).toBe(4);
    expect(mesh.surfaces[1]!.vertexCount).toBe(4);
  });

  it("addresses a surface material declared in the mesh's own .tres as a sub-resource path", () => {
    // Godot writes this form whenever the mesh carries its own materials
    // instead of referencing shared ones (every Truck Town vehicle). The
    // material lives in a different document from the previewed scene, so the
    // only thing that can find it is its owning file plus its id.
    const mesh = decodeArrayMesh(OWN_MATERIAL_TRES, 'res://vehicles/meshes/wheel.tres');
    expect(mesh.surfaces[0]!.materialPath).toBe(
      'res://vehicles/meshes/wheel.tres::StandardMaterial3D_shvqh'
    );
  });

  it('decodes the [sub_resource] ArrayMesh a sub-resource path names, not the file body', () => {
    // A `.tres` can hold several ArrayMeshes: the `[resource]` one plus e.g. its
    // `shadow_mesh` as a `[sub_resource]`. Addressed by id, the SUB-RESOURCE's
    // `_surfaces` must be read — falling through to the file body would hand
    // back a different mesh under the right-looking name.
    const mesh = decodeArrayMesh(
      NESTED_MESH_TRES,
      'res://vehicles/meshes/wheel.tres::ArrayMesh_shadow'
    );
    expect(mesh.surfaces).toHaveLength(1);
    // Only the sub-resource surface carries no material at all.
    expect(mesh.surfaces[0]!.materialPath).toBeUndefined();
    expect(mesh.surfaces[0]!.indexCount).toBe(3);
  });

  it('throws when a sub-resource path names an id the file does not declare', () => {
    // Returning an empty mesh would be cached as a SUCCESS: an invisible node
    // with no placeholder and no missing-resources row. Unreadable is not empty,
    // so it fails like a missing file and the consumer gets its placeholder.
    expect(() =>
      decodeArrayMesh(NESTED_MESH_TRES, 'res://vehicles/meshes/wheel.tres::ArrayMesh_absent')
    ).toThrow();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const message = String(warnSpy.mock.calls[0]![0]);
    expect(message).toContain('[ArrayMesh]');
    expect(message).toContain('ArrayMesh_absent');
    // The owning file, not the whole address — the address is not a file.
    expect(message).toContain('res://vehicles/meshes/wheel.tres');
    expect(message).not.toContain('::');
  });

  it('throws when a sub-resource path names something that is not a mesh', () => {
    expect(() =>
      decodeArrayMesh(
        OWN_MATERIAL_TRES,
        'res://vehicles/meshes/wheel.tres::StandardMaterial3D_shvqh'
      )
    ).toThrow();

    expect(String(warnSpy.mock.calls[0]![0])).toContain('StandardMaterial3D');
  });
});

/** The `[resource]` mesh (materialised, 6 indices) plus a bare `shadow_mesh` (3). */
const NESTED_MESH_TRES = WALL_TRES.replace(
  '[resource]',
  `[sub_resource type="ArrayMesh" id="ArrayMesh_shadow"]
_surfaces = [{
"aabb": AABB(-1, -1, 1, 2, 2, 1.001358e-05),
"format": 4097,
"index_count": 3,
"index_data": PackedByteArray("AgAAAAEA"),
"name": "shadow",
"primitive": 3,
"vertex_count": 4,
"vertex_data": PackedByteArray("AACAvwAAgL8AAIA/AACAPwAAgL8AAIA/AACAPwAAgD8AAIA/AACAvwAAgD8AAIA/")
}]

[resource]`
);

/** wheel.tres's shape: the surface's material is a `[sub_resource]` of the same file. */
const OWN_MATERIAL_TRES = WALL_TRES.replace(
  '"material": ExtResource("1_a5mma"),',
  '"material": SubResource("StandardMaterial3D_shvqh"),'
).replace(
  '[resource]',
  `[sub_resource type="StandardMaterial3D" id="StandardMaterial3D_shvqh"]
albedo_color = Color(0.2565747, 0.2565747, 0.2565747, 1)
roughness = 0.8

[resource]`
);

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

/**
 * scenes/demos/3d/truck_town/vehicles/meshes/truck_cab.tres, the `headlights`
 * surface verbatim — the smallest compressed surface in the corpus. format
 * 34896613383 = VERTEX|NORMAL|TANGENT|INDEX + ARRAY_FLAG_COMPRESS_ATTRIBUTES +
 * ARRAY_FLAG_FORMAT_VERSION_2, 12 B/vertex: 8 B of position record then a 4 B
 * normal region.
 *
 * The expected values throughout are what Godot 4.6.3's own
 * ArrayMesh.surface_get_arrays() returns for these exact bytes.
 */
const COMPRESSED_TRES = `[gd_resource type="ArrayMesh" format=4]

[resource]
_surfaces = [{
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
blend_shape_mode = 0
`;

/**
 * A compressed surface with NORMAL but NO TANGENT — format 536875011 =
 * VERTEX|NORMAL|INDEX + ARRAY_FLAG_COMPRESS_ATTRIBUTES. Hand-built, because no
 * corpus mesh is in this state: compression only folds a tangent frame into the
 * normal bytes when there IS a tangent, so here the octahedral pair is the
 * normal itself and the position record's angle slot stays zero.
 *
 * The three normals are +Y, +X and +Z, octahedral-encoded as the inverse of
 * `octToVec3` — the pair is (x, y) and z follows. Reading this through the
 * axis-angle path instead would take
 * that zero slot as `abs(0 * 2 - 1) * PI` — a half-turn, not the identity — and
 * tilt every one of them.
 */
const COMPRESSED_NO_TANGENT_TRES = `[gd_resource type="ArrayMesh" format=4]

[resource]
_surfaces = [{
"aabb": AABB(0, 0, 0, 1, 1, 1),
"format": 536875011,
"index_count": 3,
"index_data": PackedByteArray("AAABAAIA"),
"name": "no_tangent",
"primitive": 3,
"uv_scale": Vector4(0, 0, 0, 0),
"vertex_count": 3,
"vertex_data": PackedByteArray("AAAAgP//AAAAAACA//8AAAAAAID//wAAAID/////AIAAgACA")
}]
blend_shape_mode = 0
`;

describe('compressed attribute layout', () => {
  it('decodes compressed positions as uint16 normalised into the surface aabb', () => {
    const surface = decodeArrayMesh(COMPRESSED_TRES, 'res://mesh.tres').surfaces[0]!;

    expect(surface.positions).toHaveLength(4 * 3);
    expect(Array.from(surface.positions).map((p) => Number(p.toFixed(6)))).toEqual([
      0.519531, 0.180053, 1.341797, 0.416992, 0.117615, 1.361328, 0.431884, 0.184692, 1.339844,
      0.518555, 0.114807, 1.363281,
    ]);
  });

  it('decodes a compressed normal from the axis-angle TBN, angle in the position record', () => {
    // Compressed surfaces do not store the normal. The octahedral pair in the
    // normal region is a rotation AXIS, and the angle is the 4th uint16 of the
    // 8-byte position record — the slot a VERTEX-only surface leaves zeroed.
    // Reading that pair as a normal yields a direction unrelated to the surface.
    const surface = decodeArrayMesh(COMPRESSED_TRES, 'res://mesh.tres').surfaces[0]!;

    expect(surface.normals).toHaveLength(4 * 3);
    for (let v = 0; v < 4; v++) {
      expect(surface.normals![v * 3 + 0]).toBeCloseTo(-0.00742, 5);
      expect(surface.normals![v * 3 + 1]).toBeCloseTo(0.30958, 5);
      expect(surface.normals![v * 3 + 2]).toBeCloseTo(0.95085, 5);
    }
  });

  it('decodes a compressed normal whose frame angle is below the midpoint', () => {
    // The angle's stored sign carries the binormal's HANDEDNESS, not the
    // rotation's direction, so Godot takes its absolute value. Reading it signed
    // rotates the frame backwards for every vertex below the midpoint and flips
    // the normal's x and y — invisible in a fixture that stores the midpoint
    // exactly, where the absolute value is a no-op.
    const surface = decodeArrayMesh(COMPRESSED_LOW_ANGLE_TRES, 'res://q.tres').surfaces[0]!;

    for (let v = 0; v < 4; v++) {
      expect(surface.normals![v * 3 + 0]).toBeCloseTo(0.113141, 5);
      expect(surface.normals![v * 3 + 1]).toBeCloseTo(0.197363, 5);
      expect(surface.normals![v * 3 + 2]).toBeCloseTo(0.97378, 5);
    }
  });

  it('reads a compressed NORMAL-without-TANGENT pair as the normal, not an axis-angle frame', () => {
    const surface = decodeArrayMesh(COMPRESSED_NO_TANGENT_TRES, 'res://n.tres').surfaces[0]!;
    const n = surface.normals!;
    // Tolerance 4: a "zero" component is stored as 32768, which decodes to
    // 1.5e-5 rather than 0 — the uint16 grid, not a decode error.
    [0, 1, 0, 1, 0, 0, 0, 0, 1].forEach((expected, i) => {
      expect(n[i]).toBeCloseTo(expected, 4);
    });
  });

  it('drops a compressed surface that declares no aabb', () => {
    // The aabb IS the position scale for a compressed surface, so without it
    // there is nothing to dequantise against. This mesh has only that surface,
    // so nothing survives and the whole decode fails rather than yielding an
    // empty mesh that would cache as a success.
    const noAabb = COMPRESSED_TRES.replace(
      '"aabb": AABB(0.416992, 0.114807, 1.339844, 0.102539, 0.06988499, 0.023437023),\n',
      ''
    );

    expect(() => decodeArrayMesh(noAabb, 'res://mesh.tres')).toThrow();
    expect(String(warnSpy.mock.calls[0]![0])).toContain('no decodable positions');
  });

  it('decodes compressed UVs as unorm16 when uv_scale is zero', () => {
    const surface = decodeArrayMesh(COMPRESSED_UV_TRES, 'res://mesh.tres').surfaces[0]!;

    expect(surface.uvs).toHaveLength(24 * 2);
    expect(Array.from(surface.uvs!.slice(0, 8)).map((v) => Number(v.toFixed(7)))).toEqual([
      0.0028687, 0.6605783, 0.9963531, 0.1297017, 0.9963531, 0.6605783, 0.0028687, 0.1297017,
    ]);
  });

  it('reads compressed UV1 past the vertex colour', () => {
    // The attribute record is COLOR then UV1, and compression halves UV1 to 4
    // bytes but leaves RGBA8 at 4 — so the colour offset does not move.
    const surface = decodeArrayMesh(COMPRESSED_COLOR_UV_TRES, 'res://mesh.tres').surfaces[0]!;

    expect(Array.from(surface.uvs!)).toEqual([0, 1, 1, 1, 1, 0, 0, 0]);
  });

  it('dequantises compressed UVs through a non-zero uv_scale', () => {
    // Godot normalises UVs that leave [-1,1] into the uint16 range and records
    // the divisor in uv_scale; a zero uv_scale means the stored value IS the UV.
    // This quad's UVs run 0..4, which Godot stored against uv_scale 8.
    const surface = decodeArrayMesh(COMPRESSED_UVSCALE_TRES, 'res://mesh.tres').surfaces[0]!;

    expect(Array.from(surface.uvs!).map((v) => Number(v.toFixed(6)))).toEqual([
      -0.000061, 4, 4, 4, 4, -0.000061, -0.000061, -0.000061,
    ]);
  });

  it('emits no UVs when attribute_data is not the size the format implies', () => {
    // An unmodelled CUSTOM0..3 channel widens the record, so UV1 is no longer
    // where the format says. That costs the UVs, not the surface.
    const truncated = COMPRESSED_UV_TRES.replace(
      /"attribute_data": PackedByteArray\("[^"]*"\)/,
      '"attribute_data": PackedByteArray("vAAbqRD/NCEQ/xupvAA0IQ==")'
    );
    const surface = decodeArrayMesh(truncated, 'res://mesh.tres').surfaces[0]!;

    expect(surface.uvs).toBeUndefined();
    for (const p of surface.positions) expect(Number.isFinite(p)).toBe(true);
  });
});

/**
 * A compressed quad saved by Godot 4.6.3 whose tangent handedness puts the stored
 * frame angle at uint16 15684 — well below the midpoint, where reading the angle
 * signed instead of absolute gives a visibly wrong normal. Expected values are
 * Godot's own `surface_get_arrays()[ARRAY_NORMAL]` for these bytes.
 */
const COMPRESSED_LOW_ANGLE_TRES = `[gd_resource type="ArrayMesh" format=4]

[resource]
_surfaces = [{
"aabb": AABB(-1, -1, 1, 2, 2, 1e-05),
"format": 34896613383,
"index_count": 6,
"index_data": PackedByteArray("AgAAAAMAAgABAAAA"),
"name": "low_angle",
"primitive": 3,
"uv_scale": Vector4(0, 0, 0, 0),
"vertex_count": 4,
"vertex_data": PackedByteArray("AAAAAAAARD3//wAAAABEPf////8AAEQ9AAD//wAARD1t7wMEbe8DBG3vAwRt7wME")
}]
blend_shape_mode = 0
`;

/**
 * scenes/demos/3d/truck_town/vehicles/meshes/truck_trailer.tres, its
 * `truck_trailer` surface verbatim — the corpus's only compressed surface that
 * also carries TEX_UV. format 34896613399 adds TEX_UV to the compressed set, so
 * `attribute_data` is 4 B/vertex.
 */
const COMPRESSED_UV_TRES = `[gd_resource type="ArrayMesh" format=4]

[resource]
_surfaces = [{
"aabb": AABB(-0.625, -0.00771, -2.005859, 1.240234, 1.121968, 4.199218),
"attribute_data": PackedByteArray("vAAbqRD/NCEQ/xupvAA0IfnbeP/69pvO+vZ4//nbm87eABupuf/rILn/G6neAOsgVhqu+oMDN8hWGjfIgwOu+uB4ocfWHP791hyhx+B4/v3o2A/HS3zE/Ut8D8fo2MT9"),
"format": 34896613399,
"index_count": 36,
"index_data": PackedByteArray("AAABAAIAAAADAAEABAAFAAYABAAHAAUACAAJAAoACAALAAkADAANAA4ADAAPAA0AEAARABIAEAATABEAFAAVABYAFAAXABUA"),
"name": "truck_trailer",
"primitive": 3,
"uv_scale": Vector4(0, 0, 0, 0),
"vertex_count": 24,
"vertex_data": PackedByteArray("AAAAAAAA/78AAP//////vwAAAAD///+/AAD//wAA/7///wAAAAD//wAA//8AAP//AAAAAAAA////////AAD/////AAD///+//////wAA/7///wAAAAD/v/////////+/AAAAAP///7//////////v///AAD///+/AAD//////7///wAAAABU1QAAAAD//1TV//8AAP//VNUAAAAAAABU1QAA//8AAFTV////////VNUAAP////9U1f////8AAFTV/3////9//v//f/7//3////9/////f////3////9/////fwAA/38AAP9/AAD/fwAA/3//f/9//3//f/9//3//f1RVVFVVVVRVVVVUVVRVVFVU1aoqVNWqKlTVqipU1aoq")
}]
blend_shape_mode = 0
`;

/**
 * The unit quad re-saved by Godot 4.6.3 with ARRAY_FLAG_COMPRESS_ATTRIBUTES and
 * a vertex colour: format 34896613407, an 8 B attribute record of RGBA8 + 2×uint16.
 */
const COMPRESSED_COLOR_UV_TRES = `[gd_resource type="ArrayMesh" format=4]

[resource]
_surfaces = [{
"aabb": AABB(-1, -1, 1, 2, 2, 1e-05),
"attribute_data": PackedByteArray("/wAA/wAA//8A/wD//////wAA/////wAA/////wAAAAA="),
"format": 34896613407,
"index_count": 6,
"index_data": PackedByteArray("AgAAAAMAAgABAAAA"),
"name": "compressed_color_uv",
"primitive": 3,
"uv_scale": Vector4(0, 0, 0, 0),
"vertex_count": 4,
"vertex_data": PackedByteArray("AAAAAAAAAID//wAAAAAAgP////8AAACAAAD//wAAAID/f////3////9/////f///")
}]
blend_shape_mode = 0
`;

/** The same quad with its UVs running 0..4, which forces a non-zero uv_scale. */
const COMPRESSED_UVSCALE_TRES = `[gd_resource type="ArrayMesh" format=4]

[resource]
_surfaces = [{
"aabb": AABB(-1, -1, 1, 2, 2, 1e-05),
"attribute_data": PackedByteArray("/3////////////9//3//fw=="),
"format": 34896613399,
"index_count": 6,
"index_data": PackedByteArray("AgAAAAMAAgABAAAA"),
"name": "compressed_uvscale",
"primitive": 3,
"uv_scale": Vector4(8, 8, 0, 0),
"vertex_count": 4,
"vertex_data": PackedByteArray("AAAAAAAAAID//wAAAAAAgP////8AAACAAAD//wAAAID/f////3////9/////f///")
}]
blend_shape_mode = 0
`;

/**
 * A surface that declares 4 vertices but carries only 2 vertices' worth of
 * `vertex_data`. format 4097 = VERTEX|INDEX, so positions are all there is.
 */
const TRUNCATED_TRES = `[gd_resource type="ArrayMesh" format=4]

[resource]
_surfaces = [{
"aabb": AABB(-1, -1, 1, 2, 2, 0),
"format": 4097,
"index_count": 3,
"index_data": PackedByteArray("AAABAAIA"),
"name": "truncated",
"primitive": 3,
"uv_scale": Vector4(0, 0, 0, 0),
"vertex_count": 4,
"vertex_data": PackedByteArray("AACAvwAAgL8AAIA/AACAPwAAgL8AAIA/")
}]
`;

/** Same shape, full length, but vertex 0's x is a float32 NaN bit pattern. */
const NON_FINITE_TRES = `[gd_resource type="ArrayMesh" format=4]

[resource]
_surfaces = [{
"aabb": AABB(-1, -1, 1, 2, 2, 0),
"format": 4097,
"index_count": 3,
"index_data": PackedByteArray("AAABAAIA"),
"name": "not_finite",
"primitive": 3,
"uv_scale": Vector4(0, 0, 0, 0),
"vertex_count": 4,
"vertex_data": PackedByteArray("AADAfwAAgL8AAIA/AACAPwAAgL8AAIA/AACAPwAAgD8AAIA/AACAvwAAgD8AAIA/")
}]
`;

/** The wall quad followed by the truncated surface, in one `_surfaces` array. */
const GOOD_THEN_BAD_TRES = WALL_TRES.replace(
  '}]\nblend_shape_mode = 0',
  `}, {
"aabb": AABB(-1, -1, 1, 2, 2, 0),
"format": 4097,
"index_count": 3,
"index_data": PackedByteArray("AAABAAIA"),
"name": "truncated",
"primitive": 3,
"uv_scale": Vector4(0, 0, 0, 0),
"vertex_count": 4,
"vertex_data": PackedByteArray("AACAvwAAgL8AAIA/AACAPwAAgL8AAIA/")
}]
blend_shape_mode = 0`
);

/** The mirror image: the UNREADABLE surface first, so the survivor is Godot's surface 1. */
const BAD_THEN_GOOD_TRES = WALL_TRES.replace(
  '_surfaces = [{',
  `_surfaces = [{
"aabb": AABB(-1, -1, 1, 2, 2, 0),
"format": 4097,
"index_count": 3,
"index_data": PackedByteArray("AAABAAIA"),
"name": "truncated",
"primitive": 3,
"uv_scale": Vector4(0, 0, 0, 0),
"vertex_count": 4,
"vertex_data": PackedByteArray("AACAvwAAgL8AAIA/AACAPwAAgL8AAIA/")
}, {`
);

describe('undecodable surfaces', () => {
  it('fails a mesh whose ONLY surface has vertex_data shorter than its format requires', () => {
    // Per-surface dropping is what keeps a mesh's readable surfaces; when nothing
    // is left there is no mesh, and saying so is what earns the consumer its
    // magenta placeholder and a missing-resources row. Returning an empty mesh
    // would be cached as a success and render invisibly instead.
    expect(() => decodeArrayMesh(TRUNCATED_TRES, 'res://mesh.tres')).toThrow();
  });

  it('fails a mesh whose ONLY surface decodes to non-finite positions', () => {
    // A single NaN reaches THREE.BufferGeometry and NaNs the merged bounding
    // sphere for every surface above it, which also breaks camera framing.
    expect(() => decodeArrayMesh(NON_FINITE_TRES, 'res://mesh.tres')).toThrow();
  });

  it('fails a mesh whose ONLY surface has index_data shorter than its index_count', () => {
    // A short index buffer used to throw a RangeError from deep inside the read,
    // bypassing the per-surface drop entirely.
    const shortIndices = GOOD_THEN_BAD_TRES.replace(
      '"index_data": PackedByteArray("AgAAAAMAAgABAAAA"),',
      '"index_data": PackedByteArray("AgAA"),'
    );

    expect(() => decodeArrayMesh(shortIndices, 'res://mesh.tres')).toThrow();
    expect(
      warnSpy.mock.calls.some((c: unknown[]) => String(c[0]).includes('index_data'))
    ).toBe(true);
  });

  it('warns with the surface name and format when it drops a surface', () => {
    expect(() => decodeArrayMesh(TRUNCATED_TRES, 'res://mesh.tres')).toThrow();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const message = String(warnSpy.mock.calls[0]![0]);
    expect(message).toContain('[ArrayMesh]');
    expect(message).toContain('truncated');
    expect(message).toContain('4097');
  });

  it('keeps the surfaces it can read when a sibling surface is dropped', () => {
    const mesh = decodeArrayMesh(GOOD_THEN_BAD_TRES, 'res://mesh.tres');

    expect(mesh.surfaces).toHaveLength(1);
    expect(mesh.surfaces[0]!.materialPath).toBe('res://stage/tile_material.tres');
    for (const p of mesh.surfaces[0]!.positions) expect(Number.isFinite(p)).toBe(true);
  });

  it('reports each surface\u2019s ORIGINAL index, which a drop above it does not shift', () => {
    // `surface_material_override/N` names the index in `_surfaces`, so a survivor
    // that moved down the compacted list has to keep saying where it came from.
    const mesh = decodeArrayMesh(BAD_THEN_GOOD_TRES, 'res://mesh.tres');

    expect(mesh.surfaces).toHaveLength(1);
    expect(mesh.surfaces[0]!.surfaceIndex).toBe(1);
  });

  it('numbers surfaces from zero when nothing is dropped', () => {
    const mesh = decodeArrayMesh(TWO_SURFACE_TRES, 'res://mesh.tres');

    expect(mesh.surfaces.map((s) => s.surfaceIndex)).toEqual([0, 1]);
  });
});

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
    const surface = decodeArrayMesh(COLOR_UV_TRES, 'res://mesh.tres').surfaces[0]!;

    expect(Array.from(surface.uvs!)).toEqual([0.25, 0.5, 0.75, 1]);
  });
});

/**
 * ONE quad, saved twice: the same four vertices, normals, UVs and indices, once
 * uncompressed (format 34359742487) and once with ARRAY_FLAG_COMPRESS_ATTRIBUTES
 * (format 34896613399). The two blobs share nothing byte-for-byte, so the only
 * thing that can make them agree is both layouts being read correctly.
 *
 * Godot itself treats the pair as interchangeable — the two encodings go through
 * `_unpack_vertex_attributes`
 * (`servers/rendering/renderer_rd/shaders/forward_clustered/scene_forward_clustered.glsl`)
 * and converge on the same vertex, normal and UV — so any divergence between
 * them is ours.
 */
const SAME_QUAD_UNCOMPRESSED_TRES = `[gd_resource type="ArrayMesh" format=4]

[resource]
_surfaces = [{
"aabb": AABB(-1, -1, 1, 2, 2, 1.001358e-05),
"attribute_data": PackedByteArray("AAAAAAAAgD8AAIA/AACAPwAAgD8AAAAAAAAAAAAAAAA="),
"format": 34359742487,
"index_count": 6,
"index_data": PackedByteArray("AgAAAAMAAgABAAAA"),
"primitive": 3,
"uv_scale": Vector4(0, 0, 0, 0),
"vertex_count": 4,
"vertex_data": PackedByteArray("AACAvwAAgL8AAIA/AACAPwAAgL8AAIA/AACAPwAAgD8AAIA/AACAvwAAgD8AAIA//3//f////7//f/9/////v/9//3////+//3//f////78=")
}]
blend_shape_mode = 0
`;

const SAME_QUAD_COMPRESSED_TRES = `[gd_resource type="ArrayMesh" format=4]

[resource]
_surfaces = [{
"aabb": AABB(-1, -1, 1, 2, 2, 1e-05),
"attribute_data": PackedByteArray("AAD//////////wAAAAAAAA=="),
"format": 34896613399,
"index_count": 6,
"index_data": PackedByteArray("AgAAAAMAAgABAAAA"),
"primitive": 3,
"uv_scale": Vector4(0, 0, 0, 0),
"vertex_count": 4,
"vertex_data": PackedByteArray("AAAAAAAAAID//wAAAAAAgP////8AAACAAAD//wAAAID/f////3////9/////f///")
}]
blend_shape_mode = 0
`;

describe('one quad in both layouts', () => {
  // Godot 4.6.3 `ArrayMesh.surface_get_arrays()` over these exact bytes.
  const VERTEX = [-1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1];
  const TEX_UV = [0, 1, 1, 1, 1, 0, 0, 0];
  const INDEX = [2, 0, 3, 2, 1, 0];

  it('decodes the uncompressed layout to Godot’s own arrays', () => {
    const surface = decodeArrayMesh(SAME_QUAD_UNCOMPRESSED_TRES, 'res://q.tres').surfaces[0]!;

    expect(Array.from(surface.positions)).toEqual(VERTEX);
    expect(Array.from(surface.uvs!)).toEqual(TEX_UV);
    expect(Array.from(surface.indices)).toEqual(INDEX);
    // ARRAY_NORMAL = (-0.000015, -0.000015, 1.0) per vertex: a "zero" octahedral
    // component is stored as 32767, one step off the uint16 grid's midpoint.
    for (let v = 0; v < 4; v++) {
      expect(surface.normals![v * 3 + 0]).toBeCloseTo(-0.000015, 6);
      expect(surface.normals![v * 3 + 1]).toBeCloseTo(-0.000015, 6);
      expect(surface.normals![v * 3 + 2]).toBeCloseTo(1, 6);
    }
  });

  it('decodes the compressed layout to Godot’s own arrays', () => {
    const surface = decodeArrayMesh(SAME_QUAD_COMPRESSED_TRES, 'res://q.tres').surfaces[0]!;

    // Quantised positions land on the uint16 grid spanning the aabb, which for
    // this aabb reproduces the corners exactly.
    expect(Array.from(surface.positions).map((p) => Number(p.toFixed(6)))).toEqual([
      -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1,
    ]);
    expect(Array.from(surface.uvs!)).toEqual(TEX_UV);
    expect(Array.from(surface.indices)).toEqual(INDEX);
    // ARRAY_NORMAL = (-0.000048, 0.0, 1.0) per vertex. It is NOT the octahedral
    // pair in the normal region — that pair is the rotation axis (0, 1, 0), and
    // reading it as a normal would give a quad facing +Y rather than +Z.
    for (let v = 0; v < 4; v++) {
      expect(surface.normals![v * 3 + 0]).toBeCloseTo(-0.000048, 6);
      expect(surface.normals![v * 3 + 1]).toBeCloseTo(0, 6);
      expect(surface.normals![v * 3 + 2]).toBeCloseTo(1, 6);
    }
  });

  it('decodes both layouts to the same surface', () => {
    // The tolerance is the quantisation gap between the two encodings, not
    // slack: a float32 position and a uint16 one over the same aabb differ by up
    // to half a grid step, and the two normal encodings disagree in the 5th
    // decimal for the same reason. Anything a shading difference could see —
    // a flipped sign, an unnormalised vector, a wrong stride — is orders of
    // magnitude larger.
    const plain = decodeArrayMesh(SAME_QUAD_UNCOMPRESSED_TRES, 'res://q.tres').surfaces[0]!;
    const packed = decodeArrayMesh(SAME_QUAD_COMPRESSED_TRES, 'res://q.tres').surfaces[0]!;

    expect(packed.vertexCount).toBe(plain.vertexCount);
    for (let i = 0; i < plain.positions.length; i++) {
      expect(packed.positions[i]).toBeCloseTo(plain.positions[i]!, 4);
    }
    for (let i = 0; i < plain.normals!.length; i++) {
      expect(packed.normals![i]).toBeCloseTo(plain.normals![i]!, 4);
    }
    expect(Array.from(packed.uvs!)).toEqual(Array.from(plain.uvs!));
    expect(Array.from(packed.indices)).toEqual(Array.from(plain.indices));
  });
});

/**
 * The second surface of TWO_SURFACE_TRES declared as LINES (primitive 1) —
 * Godot's `Mesh.PRIMITIVE_LINES`, whose index_data pairs vertices rather than
 * tripling them.
 */
const LINES_SECOND_SURFACE_TRES = TWO_SURFACE_TRES.replace(
  '"material": ExtResource("2_b"),\n"primitive": 3,',
  '"material": ExtResource("2_b"),\n"primitive": 1,'
);

/** WALL_TRES's only surface declared as a LINE_STRIP (primitive 2). */
const LINE_STRIP_ONLY_TRES = WALL_TRES.replace('"primitive": 3,', '"primitive": 2,');

describe('non-triangle primitives', () => {
  it('skips a non-triangle surface and keeps the triangle ones', () => {
    // A LINES surface's indices are vertex PAIRS; read as triangles they
    // fabricate faces that were never authored, so the surface is dropped.
    const mesh = decodeArrayMesh(LINES_SECOND_SURFACE_TRES, 'res://mesh.tres');

    expect(mesh.surfaces).toHaveLength(1);
    expect(mesh.surfaces[0]!.materialPath).toBe('res://a.tres');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('fails loudly when every surface is a non-triangle primitive', () => {
    // Nothing renderable came out, so this must not cache an empty geometry as a
    // success; the message names the primitive as the reason, not a byte defect.
    expect(() => decodeArrayMesh(LINE_STRIP_ONLY_TRES, 'res://mesh.tres')).toThrow(
      /non-triangle/
    );
  });

  it('keeps decoding a surface that omits `primitive` (Godot writes 3 for triangles)', () => {
    const noPrimitive = WALL_TRES.replace('"primitive": 3,\n', '');

    expect(decodeArrayMesh(noPrimitive, 'res://mesh.tres').surfaces).toHaveLength(1);
  });
});

/**
 * godotSurfacesGeometry: Godot mesh surfaces into one THREE.BufferGeometry, one group per
 * surface, tested against the byte-exact wall.tres decode.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { decodeArrayMeshTres } from '../testing/decodeArrayMeshTres';
import type { ArrayMeshData } from './arraymesh/types';
import {
  geometryDrawsPoints,
  godotSurfaceParts,
  godotSurfacesGeometry,
  godotTriangleVertices,
  type GodotSurface,
} from './godotSurface';
import { headlightsSurface, wallQuadSurfaces } from '../testing/arrayMeshSurfaces';
import { UV2_ATTRIBUTE } from './uv2';

const WALL_TRES = `[gd_resource type="ArrayMesh" format=4 uid="uid://bett1yahcwe25"]

[ext_resource type="Material" path="res://stage/tile_material.tres" id="1_a5mma"]

[resource]
_surfaces = ${wallQuadSurfaces({ material: 'ExtResource("1_a5mma")' })}
blend_shape_mode = 0
`;

/**
 * The wall quad (uncompressed) followed by truck_cab.tres's `headlights` surface
 * (ARRAY_FLAG_COMPRESS_ATTRIBUTES). Godot writes both layouts into one mesh, and
 * every surface merges into one geometry, so a surface read at the wrong stride
 * does not merely draw wrong, it takes the merged bounds down with it.
 */
const MIXED_LAYOUT_TRES = WALL_TRES.replace(
  '}]\nblend_shape_mode = 0',
  `}, ${headlightsSurface({ name: 'headlights' })}]
blend_shape_mode = 0`
);

/** The single-triangle surface these tests vary one field of at a time. */
function triangle(overrides: Partial<ArrayMeshData['surfaces'][number] & GodotSurface> = {}) {
  return {
    surfaceIndex: 0,
    format: 0,
    primitive: 3,
    vertexCount: 3,
    indexCount: 3,
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    uvs: new Float32Array([0, 0, 1, 0, 0, 1]),
    indices: new Uint32Array([0, 1, 2]),
    materialPath: 'res://a.tres',
    ...overrides,
  };
}

describe('godotSurfacesGeometry', () => {
  it('builds a BufferGeometry with position, uv, index and Godot normals', () => {
    const geo = godotSurfacesGeometry(decodeArrayMeshTres(WALL_TRES, 'res://mesh.tres').surfaces);

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
          surfaceIndex: 0,
          format: 0, // no NORMAL bit → surface.normals undefined
          vertexCount: 3,
          indexCount: 3,
          // Godot-style CW winding from +Z. The builder reverses it to CCW so
          // computeVertexNormals() yields the outward +Z normal.
          positions: new Float32Array([0, 0, 0, 0, 1, 0, 1, 0, 0]),
          indices: new Uint32Array([0, 1, 2]),
        },
      ],
    };
    const geo = godotSurfacesGeometry(data.surfaces);
    expect(geo.getAttribute('normal').count).toBe(3);
    expect(geo.getAttribute('normal').getZ(0)).toBeCloseTo(1, 3);
  });

  it("flips V so Godot's top-left-origin UVs match the app's flipY=true textures", () => {
    // Godot writes V from the image top. three.js uploads textures bottom-up by
    // default (as spriteFrame.ts and tileGeometry.ts assume), so a pass-through V
    // samples an atlas mirrored. V=0 (Godot's top edge) must become V=1 here.
    const uv = godotSurfacesGeometry([
      triangle({ uvs: new Float32Array([0, 0, 1, 0.25, 0.5, 1]) }),
    ]).getAttribute('uv');

    // U is untouched. Only V is mirrored.
    expect([uv.getX(0), uv.getY(0)]).toEqual([0, 1]);
    expect([uv.getX(1), uv.getY(1)]).toEqual([1, 0.75]);
    expect([uv.getX(2), uv.getY(2)]).toEqual([0.5, 0]);
  });

  it('converts a UV-less surface too, so one geometry never holds two V spaces', () => {
    // Only some surfaces may declare TEX_UV. `hasUV` is `some`, so the merged
    // buffer covers the UV-less ones, and Godot samples those at UV (0,0), the
    // image top, which is V=1 here. At 0 they would point at the opposite edge.
    const uv = godotSurfacesGeometry([triangle(), triangle({ uvs: undefined })]).getAttribute('uv');

    expect(uv.getY(0)).toBe(1); // written 0 → image top
    expect(uv.getY(3)).toBe(1); // unwritten 0 → same edge, not the opposite one
    expect(uv.getY(4)).toBe(1);
  });

  it("writes UV2 in Godot's top-down V, which the UV2 binding samples", () => {
    const uv2 = godotSurfacesGeometry([
      triangle({ uv2s: new Float32Array([0, 0.25, 1, 0.5, 0.5, 1]) }),
    ]).getAttribute(UV2_ATTRIBUTE);

    expect(Array.from(uv2.array)).toEqual([0, 0.25, 1, 0.5, 0.5, 1]);
  });

  it('gives a mesh without UV2 no UV2 attribute', () => {
    const geometry = godotSurfacesGeometry([triangle()]);

    expect(geometry.getAttribute(UV2_ATTRIBUTE)).toBeUndefined();
  });

  it('leaves a surface without UV2 at (0, 0), where Godot samples it (edge case)', () => {
    const uv2 = godotSurfacesGeometry([
      triangle({ uv2s: new Float32Array([1, 1, 1, 1, 1, 1]) }),
      triangle(),
    ]).getAttribute(UV2_ATTRIBUTE);

    expect(Array.from(uv2.array).slice(6)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it("carries Godot's tangents as a four-component tangent attribute", () => {
    const tangents = new Float32Array([1, 0, 0, 1, 0, 0, -1, 1, 0, 1, 0, -1]);
    const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);

    const tangent = godotSurfacesGeometry([triangle({ normals, tangents })]).getAttribute('tangent');

    expect(tangent.itemSize).toBe(4);
    expect(Array.from(tangent.array)).toEqual([1, 0, 0, 1, 0, 0, -1, 1, 0, 1, 0, -1]);
  });

  it('leaves the tangents to three when a surface has none (edge case)', () => {
    const tangents = new Float32Array(12).fill(1);

    const geometry = godotSurfacesGeometry([triangle({ tangents }), triangle()]);

    expect(geometry.getAttribute('tangent')).toBeUndefined();
  });

  it('adds one draw group per surface for per-surface materials', () => {
    const geo = godotSurfacesGeometry(decodeArrayMeshTres(WALL_TRES, 'res://mesh.tres').surfaces);

    expect(geo.groups).toHaveLength(1);
    expect(geo.groups[0]).toMatchObject({ start: 0, count: 6, materialIndex: 0 });
  });

  it('computes a finite bounding sphere for a mesh mixing compressed and uncompressed surfaces', () => {
    // A compressed surface read at the uncompressed stride gives NaN positions,
    // a NaN bounding sphere for the whole geometry, and a camera that cannot frame it.
    const geo = godotSurfacesGeometry(decodeArrayMeshTres(MIXED_LAYOUT_TRES, 'res://mesh.tres').surfaces);

    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    expect(Number.isFinite(geo.boundingSphere!.radius)).toBe(true);
    expect(geo.boundingSphere!.radius).toBeGreaterThan(0);
    for (const v of [geo.boundingBox!.min, geo.boundingBox!.max]) {
      expect([v.x, v.y, v.z].every(Number.isFinite)).toBe(true);
    }
    expect(geo.groups).toHaveLength(2);
  });

  it("merges multiple surfaces, re-basing each surface's indices and grouping them", () => {
    const data: ArrayMeshData = {
      surfaces: [triangle(), triangle({ materialPath: 'res://b.tres' })],
    };

    const geo = godotSurfacesGeometry(data.surfaces);

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

describe('godotSurfacesGeometry for a points surface', () => {
  const POINT: GodotSurface = { positions: new Float32Array([1, 2, 3]), indices: [0], isPoints: true };

  it('draws each vertex through its index, in one draw group', () => {
    const geometry = godotSurfacesGeometry([POINT]);
    expect(Array.from(geometry.getIndex()!.array)).toEqual([0]);
    expect(geometry.groups).toHaveLength(1);
    expect(Array.from(geometry.getAttribute('position').array)).toEqual([1, 2, 3]);
  });

  // Godot lights a surface with no ARRAY_NORMAL as a normal of +Z in node space, measured with
  // `pnpm ref:godot` under a light from each of ten directions.
  it('gives a point the normal Godot lights it with, +Z', () => {
    const normal = godotSurfacesGeometry([POINT]).getAttribute('normal');
    expect(Array.from(normal.array)).toEqual([0, 0, 1]);
  });
});

describe('godotSurfacesGeometry of points surfaces', () => {
  const points = (positions: number[], extra: Partial<GodotSurface> = {}): GodotSurface => ({
    positions: new Float32Array(positions),
    indices: new Uint32Array([0]),
    isPoints: true,
    ...extra,
  });

  it('merges points surfaces into one geometry, a draw group each, with indices offset', () => {
    const geometry = godotSurfacesGeometry([
      points([0, 0, 0, 1, 0, 0], { indices: new Uint32Array([1, 0]) }),
      points([0, 2, 0]),
    ]);

    expect(geometry.getAttribute('position').count).toBe(3);
    expect(Array.from(geometry.getIndex()!.array)).toEqual([1, 0, 2]);
    expect(geometry.groups.map((g) => [g.start, g.count, g.materialIndex])).toEqual([
      [0, 2, 0],
      [2, 1, 1],
    ]);
  });

  it('tags the geometry as drawn by points, and a triangle geometry not', () => {
    expect(geometryDrawsPoints(godotSurfacesGeometry([points([0, 0, 0])]))).toBe(true);
    expect(geometryDrawsPoints(godotSurfacesGeometry([triangle()]))).toBe(false);
  });
});

describe('godotSurfaceParts', () => {
  const point = (tag: string): GodotSurface & { tag: string } => ({
    positions: new Float32Array([0, 0, 0]),
    indices: [0],
    isPoints: true,
    tag,
  });
  const tri = (tag: string): GodotSurface & { tag: string } => ({ ...triangle(), tag });

  it('draws a mesh of only triangles as one part', () => {
    const parts = godotSurfaceParts([tri('a'), tri('b')]);

    expect(parts).toHaveLength(1);
    expect(parts[0]!.surfaces.map((s) => s.tag)).toEqual(['a', 'b']);
    expect(geometryDrawsPoints(parts[0]!.geometry)).toBe(false);
  });

  it('draws a mesh of only points as one points part', () => {
    const parts = godotSurfaceParts([point('a')]);

    expect(parts).toHaveLength(1);
    expect(geometryDrawsPoints(parts[0]!.geometry)).toBe(true);
  });

  it('splits triangle and points surfaces into a part each, triangles first, keeping each surface', () => {
    const parts = godotSurfaceParts([point('dots'), tri('wall'), point('more dots')]);

    expect(parts.map((part) => geometryDrawsPoints(part.geometry))).toEqual([false, true]);
    expect(parts.map((part) => part.surfaces.map((s) => s.tag))).toEqual([['wall'], ['dots', 'more dots']]);
    expect(parts[1]!.geometry.groups.map((g) => g.materialIndex)).toEqual([0, 1]);
  });

  it('draws no part for a mesh with no surface', () => {
    expect(godotSurfaceParts([])).toEqual([]);
  });
});

describe('godotTriangleVertices', () => {
  const quad = (indices: number[]): GodotSurface => ({
    positions: new Float32Array(12),
    indices,
  });

  it("gives each triangle's vertices in the order Godot stored them", () => {
    const geometry = godotSurfacesGeometry([quad([0, 1, 2, 0, 2, 3])]);
    expect(Array.from(godotTriangleVertices(geometry))).toEqual([0, 1, 2, 0, 2, 3]);
  });

  it('offsets the vertices of a later surface into the merged geometry', () => {
    const geometry = godotSurfacesGeometry([quad([0, 1, 2]), quad([0, 1, 2])]);
    expect(Array.from(godotTriangleVertices(geometry))).toEqual([0, 1, 2, 4, 5, 6]);
  });

  it('reads a geometry with no index three vertices at a time, in the stored winding', () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
    expect(Array.from(godotTriangleVertices(geometry))).toEqual([0, 2, 1]);
  });

  it('drops the vertices of an incomplete triangle', () => {
    const geometry = godotSurfacesGeometry([quad([0, 1, 2, 3])]);
    expect(Array.from(godotTriangleVertices(geometry))).toEqual([0, 1, 2]);
  });
});

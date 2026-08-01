/**
 * Tests for the PrismMesh geometry build, ported from Godot
 * `PrismMesh::_create_mesh_array` (`primitive_meshes.cpp:1610-1873`).
 *
 * The prism's cross-section is a TRIANGLE in the XY plane — apex at the top, base
 * at the bottom, the apex's X placed by `left_to_right` (`:1670`) — extruded
 * along Z. Its five surfaces are the front and back triangular caps (`:1663`),
 * the two slanted sides (`:1746`) and the base (`:1822`).
 *
 * Vertex counts come from Godot's own `num_points` (`:1636`):
 * `(sh+2)(sw+2)·2 + (sh+2)(sd+2)·2 + (sd+2)(sw+2)`.
 */

import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { buildPrismMeshGeometry } from './build';
import type { PrismMeshProperties } from './types';

function prism(overrides: Partial<PrismMeshProperties> = {}): PrismMeshProperties {
  return {
    leftToRight: 0.5,
    size: { x: 1, y: 1, z: 1 },
    subdivideWidth: 0,
    subdivideHeight: 0,
    subdivideDepth: 0,
    ...overrides,
  };
}

function positionsOf(geometry: THREE.BufferGeometry): number[][] {
  const array = geometry.getAttribute('position').array;
  const out: number[][] = [];
  for (let i = 0; i < array.length; i += 3) out.push([array[i]!, array[i + 1]!, array[i + 2]!]);
  return out;
}

/** Right-hand-rule normal of triangle `t`, which points at the viewer when it is CCW. */
function windingNormal(geometry: THREE.BufferGeometry, t: number): number[] {
  const index = geometry.getIndex()!.array;
  const p = positionsOf(geometry);
  const [a, b, c] = [p[index[t * 3]!]!, p[index[t * 3 + 1]!]!, p[index[t * 3 + 2]!]!];
  const u = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!];
  const v = [c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!];
  return [
    u[1]! * v[2]! - u[2]! * v[1]!,
    u[2]! * v[0]! - u[0]! * v[2]!,
    u[0]! * v[1]! - u[1]! * v[0]!,
  ];
}

/** The stored normal of triangle `t`'s first vertex. */
function storedNormal(geometry: THREE.BufferGeometry, t: number): number[] {
  const index = geometry.getIndex()!.array;
  const normals = geometry.getAttribute('normal').array;
  const v = index[t * 3]!;
  return [normals[v * 3]!, normals[v * 3 + 1]!, normals[v * 3 + 2]!];
}

const dot = (a: number[], b: number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;

describe('buildPrismMeshGeometry', () => {
  it('builds Godot\'s vertex and triangle counts for an unsubdivided prism', () => {
    const geometry = buildPrismMeshGeometry(prism());

    // (0+2)(0+2)·2 + (0+2)(0+2)·2 + (0+2)(0+2) = 20 vertices; 8 triangles =
    // 2 caps + 2 slanted quads + 1 base quad.
    expect(geometry.getAttribute('position').count).toBe(20);
    expect(geometry.getIndex()!.count).toBe(24);
  });

  it('scales its vertex count with each subdivision axis, per Godot num_points', () => {
    expect(buildPrismMeshGeometry(prism({ subdivideWidth: 1 })).getAttribute('position').count).toBe(
      26
    );
    // sh=1: (1+2)(0+2)·2 + (1+2)(0+2)·2 + (0+2)(0+2) = 12 + 12 + 4.
    expect(
      buildPrismMeshGeometry(prism({ subdivideHeight: 1 })).getAttribute('position').count
    ).toBe(28);
    expect(buildPrismMeshGeometry(prism({ subdivideDepth: 1 })).getAttribute('position').count).toBe(
      26
    );
  });

  it('fills its size box exactly, centred on the origin', () => {
    const geometry = buildPrismMeshGeometry(prism({ size: { x: 2, y: 4, z: 6 } }));
    geometry.computeBoundingBox();
    const { min, max } = geometry.boundingBox!;

    expect([min.x, min.y, min.z]).toEqual([-1, -2, -3]);
    expect([max.x, max.y, max.z]).toEqual([1, 2, 3]);
  });

  it('puts the apex at the top and the full-width base at the bottom', () => {
    const p = positionsOf(buildPrismMeshGeometry(prism()));
    const top = p.filter((v) => Math.abs(v[1]! - 0.5) < 1e-6);
    const bottom = p.filter((v) => Math.abs(v[1]! + 0.5) < 1e-6);

    // The whole top row collapses onto the apex line; the base spans size.x.
    for (const v of top) expect(v[0]).toBeCloseTo(0, 6);
    expect(Math.min(...bottom.map((v) => v[0]!))).toBeCloseTo(-0.5, 6);
    expect(Math.max(...bottom.map((v) => v[0]!))).toBeCloseTo(0.5, 6);
  });

  it('places the apex by left_to_right rather than ignoring it', () => {
    // start_x = start_pos.x + (1 - scale) * size.x * left_to_right (:1670); the
    // apex row is scale 0, so the apex sits at -size.x/2 + size.x * ltr.
    const apexX = (leftToRight: number, sizeX = 1) => {
      const p = positionsOf(
        buildPrismMeshGeometry(prism({ leftToRight, size: { x: sizeX, y: 1, z: 1 } }))
      );
      return p.filter((v) => Math.abs(v[1]! - 0.5) < 1e-6).map((v) => v[0]!);
    };

    for (const x of apexX(0)) expect(x).toBeCloseTo(-0.5, 6);
    for (const x of apexX(1)) expect(x).toBeCloseTo(0.5, 6);
    for (const x of apexX(0.25, 2)) expect(x).toBeCloseTo(-0.5, 6);
  });

  it('is extruded along Z, so every unsubdivided vertex sits on a cap plane', () => {
    for (const v of positionsOf(buildPrismMeshGeometry(prism()))) {
      expect(Math.abs(Math.abs(v[2]!) - 0.5)).toBeLessThan(1e-6);
    }
  });

  it('winds every triangle so its front face agrees with its stored normal', () => {
    // Godot fronts triangles clockwise and three expects counter-clockwise, so
    // each triple is reversed on the way out; if it were not, every face would be
    // back-culled while its normal still pointed outward.
    const geometry = buildPrismMeshGeometry(prism());

    for (let t = 0; t < geometry.getIndex()!.count / 3; t++) {
      expect(dot(windingNormal(geometry, t), storedNormal(geometry, t))).toBeGreaterThan(0);
    }
  });

  it('carries a UV per vertex', () => {
    const geometry = buildPrismMeshGeometry(prism());

    expect(geometry.getAttribute('uv').count).toBe(geometry.getAttribute('position').count);
  });
});

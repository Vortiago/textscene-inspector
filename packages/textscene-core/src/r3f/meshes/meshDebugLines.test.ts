/** `meshDebugLines` returns Godot's `Mesh::generate_debug_mesh_lines` segments (`mesh.cpp:466-501`). */

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { godotSurfacesGeometry, type GodotSurface } from '../../resources/meshes/godotSurface';
import type { SurfacedMesh } from './meshContent';
import { meshDebugLines } from './meshDebugLines';

function surface(positions: number[], indices: number[], isPoints = false): GodotSurface {
  return { positions: new Float32Array(positions), indices, isPoints };
}

function meshOf(...surfaces: GodotSurface[]): SurfacedMesh {
  const part = (kind: GodotSurface[]) => ({
    geometry: godotSurfacesGeometry(kind),
    surfaceIndices: kind.map((_surface, index) => index),
    materials: kind.map(() => undefined),
  });
  const triangles = surfaces.filter((s) => !s.isPoints);
  const points = surfaces.filter((s) => s.isPoints);
  const [first, ...rest] = [triangles, points].filter((kind) => kind.length > 0).map(part);
  return { parts: [first!, ...rest] };
}

const TRIANGLE = [0, 0, 0, 1, 0, 0, 0, 1, 0];

describe('meshDebugLines', () => {
  it('runs v0 to v1, v1 to v2 and v2 to v0 for one triangle, in Godot winding', () => {
    const lines = meshDebugLines(meshOf(surface(TRIANGLE, [0, 1, 2])));
    expect(Array.from(lines)).toEqual([0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0]);
  });

  it('repeats a shared edge once for each triangle that holds it', () => {
    const quad = [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0];
    const lines = meshDebugLines(meshOf(surface(quad, [0, 1, 2, 0, 2, 3])));
    expect(lines.length / 6).toBe(6);
    expect(Array.from(lines.slice(6, 12))).toEqual([1, 0, 0, 1, 1, 0]);
    expect(Array.from(lines.slice(24, 30))).toEqual([1, 1, 0, 0, 1, 0]);
  });

  it('takes the surfaces in order', () => {
    const second = [5, 5, 5, 6, 5, 5, 5, 6, 5];
    const lines = meshDebugLines(meshOf(surface(TRIANGLE, [0, 1, 2]), surface(second, [0, 1, 2])));
    expect(lines.length / 6).toBe(6);
    expect(Array.from(lines.slice(0, 3))).toEqual([0, 0, 0]);
    expect(Array.from(lines.slice(18, 21))).toEqual([5, 5, 5]);
  });

  it('reads a geometry with no index three vertices at a time', () => {
    const geometry = new THREE.BufferGeometry();
    // Stored in three's winding: Godot's (0,0,0), (1,0,0), (0,1,0) reads (v0, v2, v1).
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0, 1, 0, 1, 0, 0]), 3)
    );
    const lines = meshDebugLines({ parts: [{ geometry, surfaceIndices: [0], materials: [undefined] }] });
    expect(Array.from(lines)).toEqual([0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0]);
  });

  it('adds nothing for a points surface', () => {
    const lines = meshDebugLines(meshOf(surface(TRIANGLE, [0, 1, 2], true)));
    expect(lines).toHaveLength(0);
  });

  it('adds nothing for a triangle surface with no triangle', () => {
    expect(meshDebugLines(meshOf(surface(TRIANGLE, [])))).toHaveLength(0);
  });
});

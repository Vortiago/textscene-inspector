/**
 * Geometry builders for the navigation debug overlay, shared by NavigationRegion3D
 * and NavigationRegion2D over their slice decodes. Godot draws a navmesh as a
 * translucent fill plus edge lines, so both build the same two geometries from
 * `[positions, polygons]`, unlit and transparent.
 */

import * as THREE from 'three';
import { fanTriangulate } from '../resources/shapes/packedArray';
import { materialProgramInputs } from './materialProgramInputs';

/** Godot's default navigation debug face color (translucent green/teal). */
export const NAV_OVERLAY_COLOR = 0x33d17f;

/**
 * The edge-line material both regions draw. Literal-only, so the key is constant
 * and an overlay never remounts. The faces material stays with each node type, at
 * opacity 0.35 in 2D and 0.38 in 3D.
 */
export const NAV_EDGES_MATERIAL = materialProgramInputs({
  props: { color: NAV_OVERLAY_COLOR, transparent: true, opacity: 0.9, depthWrite: false },
});

/** Filled overlay: fan-triangulated polygons over the navmesh faces. */
export function buildNavFaceGeometry(positions: Float32Array, polygons: number[][]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const indices: number[] = [];
  for (const polygon of polygons) {
    const tris = fanTriangulate(polygon);
    for (const idx of tris) indices.push(idx);
  }
  geometry.setIndex(indices);
  return geometry;
}

/** Edge lines: each polygon's boundary loop as LineSegments index pairs. */
export function buildNavEdgeGeometry(positions: Float32Array, polygons: number[][]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3));
  const edges: number[] = [];
  for (const polygon of polygons) {
    for (let i = 0; i < polygon.length; i++) {
      edges.push(polygon[i]!, polygon[(i + 1) % polygon.length]!);
    }
  }
  geometry.setIndex(edges);
  return geometry;
}

/**
 * Lift a flat `PackedVector2Array` into 3D positions at z = 0, negating Y as
 * `node2dGroupProps` does. `navigation_region_2d.cpp::_update_debug_mesh()` copies
 * the vertices verbatim, so they are raw +Y-down local pixels.
 */
export function vector2ToPositions(flat: Float32Array): Float32Array {
  const count = Math.floor(flat.length / 2);
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3 + 0] = flat[i * 2 + 0]!;
    // `0 - v` (not `-v`) so a zero input stays +0, never -0.
    positions[i * 3 + 1] = 0 - flat[i * 2 + 1]!;
    positions[i * 3 + 2] = 0;
  }
  return positions;
}

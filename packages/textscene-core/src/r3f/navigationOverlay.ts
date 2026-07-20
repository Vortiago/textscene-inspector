/**
 * Shared geometry builders for the navigation debug overlay (NavigationRegion3D
 * / NavigationRegion2D). Godot draws navmeshes as a translucent filled overlay
 * plus edge lines — not solid scene geometry — so both node types build the
 * same two geometries from `[positions, polygons]` and render them unlit and
 * transparent.
 */

import * as THREE from 'three';
import { fanTriangulate } from '../resources/shapes/packedArray';

/** Godot's default navigation debug face color (translucent green/teal). */
export const NAV_OVERLAY_COLOR = 0x33d17f;

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
 * Lift a flat `PackedVector2Array` (x, y pairs) into 3D positions at z = 0,
 * negating Y.
 *
 * A NavigationPolygon's vertices are raw local canvas pixels in Godot's
 * **+Y-down** space — `navigation_region_2d.cpp::_update_debug_mesh()` copies
 * them verbatim and draws them under the region's Node2D transform with an
 * identity mesh transform. Passing that Y through unchanged mirrors the whole
 * navmesh about the region's origin; every other 2D slice does the same
 * negation in `node2dGroupProps`.
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

/**
 * A surface a canvas mesh drawer hands to `CanvasMeshBody`: a geometry in three's frame and the
 * colour facts its draw carries. `canvasSurfaceGeometry` builds the geometry from Godot-space arrays.
 */

import * as THREE from 'three';
import type { Rgba } from '../../godot/math/math';
import { bottomUpV } from '../../godot/math/uv';

/**
 * What a `color` attribute holds. 'stored': the sRGB numbers as authored. 'instance': decoded
 * already, times an instance colour.
 */
export type CanvasVertexColors = 'stored' | 'instance';

export interface CanvasSurface {
  geometry: THREE.BufferGeometry;
  /**
   * The one colour the draw carries for every vertex, as Polygon2D `color` and Line2D
   * `default_color` are. Absent is white. Keep it stable: a new object converts it again.
   */
  arrayColor?: Rgba;
  /** What the geometry's `color` attribute holds. Default 'stored'. */
  vertexColors?: CanvasVertexColors;
  position?: [number, number, number];
  scale?: [number, number, number];
  /** Places the surface by a matrix instead, which `position` and `scale` then leave alone. */
  matrix?: THREE.Matrix4;
  /** Receives the object that draws the surface: a mesh, points or line segments, by the geometry. */
  meshRef?: (drawn: THREE.Object3D | null) => void;
}

/** A surface's vertices in Godot's 2D space: +Y down, and V down from the top of the image. */
export interface CanvasSurfaceArrays {
  /** x, y for each vertex. */
  positions: Float32Array;
  /** u, v for each vertex. Hand over the doubles a drawer computes, so V flips before its one rounding. */
  uvs?: ArrayLike<number> | null;
  /** r, g, b, a for each vertex. */
  colors?: Float32Array | null;
  indices?: number[];
}

/**
 * The geometry of `arrays` in three's frame: Y negated, V flipped, and colours four wide, so three
 * defines `USE_COLOR_ALPHA` and an authored alpha draws.
 *
 * @canonical The geometry of a canvas surface from Godot-space arrays
 */
export function canvasSurfaceGeometry({
  positions,
  uvs,
  colors,
  indices,
}: CanvasSurfaceArrays): THREE.BufferGeometry {
  const vertexCount = positions.length / 2;
  const position = new Float32Array(vertexCount * 3);
  for (let i = 0; i < vertexCount; i++) {
    position[i * 3] = positions[i * 2]!;
    position[i * 3 + 1] = -positions[i * 2 + 1]!;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  if (uvs) geometry.setAttribute('uv', new THREE.BufferAttribute(threeUvs(uvs), 2));
  if (colors) geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  if (indices) geometry.setIndex(indices);
  return geometry;
}

function threeUvs(uvs: ArrayLike<number>): Float32Array {
  const out = new Float32Array(uvs.length);
  for (let i = 0; i < uvs.length; i += 2) {
    out[i] = uvs[i]!;
    out[i + 1] = bottomUpV(uvs[i + 1]!);
  }
  return out;
}

/**
 * The skin of a Polygon2D bound to a Skeleton2D, three-free and in Godot's +Y-down pixels: the
 * bone weights each vertex keeps (`polygon_2d.cpp:242-305`), and the point the skeleton pass
 * moves each vertex to (`skeleton.glsl:157-182`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import {
  affineInverseTransform2D,
  transform2DXform,
  type Transform2DColumns,
} from '../../../godot/math/transform2d.js';
import type { Vector2 } from '../../../godot/math/vector.js';

/** A vertex keeps at most this many bones (`ARRAY_BONES` of a 2D mesh, `polygon_2d.cpp:246-247`). */
const BONES_PER_VERTEX = 4;

/** `mesh_create_surface_data_from_arrays` stores each weight as a 16-bit unorm (`rendering_server.cpp:846`). */
const WEIGHT_STEPS = 65535;

/** One `bones` entry: the index of its bone in the skeleton, and one weight for each vertex. */
export interface BoneWeights {
  bone: number;
  weights: ArrayLike<number>;
}

/** Four bones and four weights for each vertex, as the skin buffer stores them. */
export interface VertexInfluences {
  bones: Int32Array;
  weights: Float32Array;
}

/**
 * The bones and weights of `vertexCount` vertices. An entry whose weight count differs from the
 * vertex count is skipped. Each vertex keeps its four largest weights, normalised to sum 1, and an
 * unpainted vertex keeps none.
 */
export function vertexInfluences(vertexCount: number, entries: readonly BoneWeights[]): VertexInfluences {
  const bones = new Int32Array(vertexCount * BONES_PER_VERTEX);
  const weights = new Float32Array(vertexCount * BONES_PER_VERTEX);
  for (const entry of entries) {
    if (entry.weights.length !== vertexCount) continue;
    for (let vertex = 0; vertex < vertexCount; vertex++) {
      const weight = entry.weights[vertex]!;
      if (weight === 0) continue;
      insertWeight(bones, weights, vertex * BONES_PER_VERTEX, entry.bone, weight);
    }
  }
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    normaliseWeights(weights, vertex * BONES_PER_VERTEX);
  }
  return { bones, weights };
}

/** Puts `weight` before the first smaller one of the vertex at `base`, pushing the rest down. */
function insertWeight(
  bones: Int32Array,
  weights: Float32Array,
  base: number,
  bone: number,
  weight: number
): void {
  for (let slot = 0; slot < BONES_PER_VERTEX; slot++) {
    if (weights[base + slot]! >= weight) continue;
    for (let later = BONES_PER_VERTEX - 1; later > slot; later--) {
      weights[base + later] = weights[base + later - 1]!;
      bones[base + later] = bones[base + later - 1]!;
    }
    weights[base + slot] = weight;
    bones[base + slot] = bone;
    return;
  }
}

function normaliseWeights(weights: Float32Array, base: number): void {
  let total = 0;
  for (let slot = 0; slot < BONES_PER_VERTEX; slot++) total += weights[base + slot]!;
  if (total === 0) return;
  for (let slot = 0; slot < BONES_PER_VERTEX; slot++) {
    const normalised = Math.fround(weights[base + slot]! / total);
    weights[base + slot] =
      Math.trunc(Math.min(Math.max(normalised * WEIGHT_STEPS, 0), WEIGHT_STEPS)) / WEIGHT_STEPS;
  }
}

/**
 * Where the skeleton pass moves each of `points`: `T * (sum of weight * bone matrix) * T^-1`, with
 * `skeletonToMesh` as `T`. The sum is a 3x3 matrix whose homogeneous corner is the weight sum, so a
 * vertex with no weight collapses to the mesh origin. A bone `boneMatrices` lacks reads as a zero
 * matrix, so its weight pulls the vertex to the skeleton origin.
 */
export function skinnedPoints(
  points: readonly Vector2[],
  influences: VertexInfluences,
  boneMatrices: readonly (Transform2DColumns | undefined)[],
  skeletonToMesh: Transform2DColumns
): Vector2[] {
  const meshToSkeleton = affineInverseTransform2D(skeletonToMesh);
  return points.map((point, vertex) => {
    const local = transform2DXform(meshToSkeleton, point);
    let x = 0;
    let y = 0;
    let homogeneous = 0;
    for (let slot = 0; slot < BONES_PER_VERTEX; slot++) {
      const index = vertex * BONES_PER_VERTEX + slot;
      const weight = influences.weights[index]!;
      if (weight === 0) continue;
      const matrix = boneMatrices[influences.bones[index]!];
      homogeneous += weight;
      if (!matrix) continue;
      const moved = xform(matrix, local.x, local.y, 1);
      x += weight * moved.x;
      y += weight * moved.y;
    }
    return xform(skeletonToMesh, x, y, homogeneous);
  });
}

/** `t` applied to the homogeneous point `(x, y, w)`: the origin counts `w` times. */
function xform(t: Transform2DColumns, x: number, y: number, w: number): Vector2 {
  return { x: t.a * x + t.c * y + t.tx * w, y: t.b * x + t.d * y + t.ty * w };
}

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

import { storedReal as f } from '../../../godot/math/real.js';
import {
  affineInverseTransform2DInto,
  mutableTransform2D,
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
  vertexCount: number;
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
  return { vertexCount, bones, weights };
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
    // `<`, as Godot compares: no weight is less than a NaN, so a NaN weight takes no slot.
    if (!(weights[base + slot]! < weight)) continue;
    for (let later = BONES_PER_VERTEX - 1; later > slot; later--) {
      weights[base + later] = weights[base + later - 1]!;
      bones[base + later] = bones[base + later - 1]!;
    }
    weights[base + slot] = weight;
    bones[base + slot] = bone;
    return;
  }
}

/** Divides by the weight sum, which Godot adds up in a float32 `real_t`. */
function normaliseWeights(weights: Float32Array, base: number): void {
  let total = 0;
  for (let slot = 0; slot < BONES_PER_VERTEX; slot++) total = Math.fround(total + weights[base + slot]!);
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
  const out = points.map(() => ({ x: 0, y: 0 }));
  return skinnedPointsInto(out, points, influences, boneMatrices, skeletonToMesh);
}

/** Written only by {@link skinnedPointsInto}, and read back before it returns. */
const meshToSkeleton = mutableTransform2D();

/**
 * {@link skinnedPoints} written into `out`, one point per point of `points`, for a render that
 * allocates nothing. The caller owns `out` and reads it before the next call.
 */
export function skinnedPointsInto(
  out: Vector2[],
  points: readonly Vector2[],
  influences: VertexInfluences,
  boneMatrices: readonly (Transform2DColumns | undefined)[],
  skeletonToMesh: Transform2DColumns
): Vector2[] {
  const toSkeleton = affineInverseTransform2DInto(meshToSkeleton, skeletonToMesh);
  points.forEach((point, vertex) => {
    // `transform2DXform` in float32, inline so the local point is no object.
    const localX = f(f(f(toSkeleton.a * point.x) + f(toSkeleton.c * point.y)) + toSkeleton.tx);
    const localY = f(f(f(toSkeleton.b * point.x) + f(toSkeleton.d * point.y)) + toSkeleton.ty);
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
      x += weight * (matrix.a * localX + matrix.c * localY + matrix.tx);
      y += weight * (matrix.b * localX + matrix.d * localY + matrix.ty);
    }
    const moved = out[vertex]!;
    moved.x = skeletonToMesh.a * x + skeletonToMesh.c * y + skeletonToMesh.tx * homogeneous;
    moved.y = skeletonToMesh.b * x + skeletonToMesh.d * y + skeletonToMesh.ty * homogeneous;
  });
  return out;
}

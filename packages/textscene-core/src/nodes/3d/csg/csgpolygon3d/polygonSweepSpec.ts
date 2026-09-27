/**
 * What a CSGPolygon3D sweep is asked for: the three modes, the resolved path plan, and the two
 * limits the builder applies before it starts. Part of the CSGPolygon3D port, whose derivation
 * notice is in `polygonGeometry.ts`.
 */

import type * as THREE from 'three';
import type { Curve3DSampler } from '../../../../resources/curves/curve3d/index.js';

/** Godot `CSGPolygon3D.Mode`. */
export const PolygonMode = { DEPTH: 0, SPIN: 1, PATH: 2 } as const;
/** Godot `CSGPolygon3D.PathRotation`. */
export const PathRotation = { POLYGON: 0, PATH: 1, PATH_FOLLOW: 2 } as const;
/** Godot `CSGPolygon3D.PathIntervalType`. */
export const PathIntervalType = { DISTANCE: 0, SUBDIVIDE: 1 } as const;

/**
 * Everything MODE_PATH needs that lives outside this node, resolved beforehand by the
 * `path_node` pass because a component cannot see its siblings.
 */
export interface CsgPolygonPathPlan {
  sampler: Curve3DSampler;
  /** The Path3D's global transform, or null when `path_local` is on (identity). */
  baseMatrix: THREE.Matrix4 | null;
  /** `Curve3D.point_count`, which PATH_INTERVAL_SUBDIVIDE counts in. */
  pointCount: number;
}

export interface CsgPolygonSpec {
  /** Flat `[x0, y0, x1, y1, …]` in Godot's order. */
  polygon: Float32Array;
  mode: number;
  depth: number;
  spinDegrees: number;
  spinSides: number;
  smoothFaces: boolean;
  flipFaces: boolean;
  pathIntervalType: number;
  pathInterval: number;
  pathSimplifyAngle: number;
  pathRotation: number;
  pathRotationAccurate: boolean;
  pathContinuousU: boolean;
  pathUDistance: number;
  pathJoined: boolean;
  /** Null when mode is not PATH, or when `path_node` did not resolve. */
  path: CsgPolygonPathPlan | null;
}

/**
 * A previewer must not hang a tab. Godot has no such cap, but a long curve at a small
 * `path_interval` runs to thousands of frames, so a runaway interval is a real shape
 * rather than a hypothetical one.
 */
export const MAX_PATH_EXTRUSIONS = 4096;

export const MIN_POLYGON_VERTICES = 3;

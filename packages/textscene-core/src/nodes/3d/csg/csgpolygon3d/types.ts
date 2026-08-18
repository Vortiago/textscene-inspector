/** CSGPolygon3D type definitions. */

import type { Node3DProperties, Transform3D } from '../../../base/node3d/types';
import type { Curve3DControlPoint } from '../../../../resources/shapes/curve3d';

/**
 * What the scene-wide `path_node` pass resolves and writes back onto the node.
 *
 * Plain serialisable data, deliberately: no closures and no `THREE.Matrix4`, because the
 * inspector and the scene-tree panel walk `node.properties` directly and would choke on
 * either. The component turns this into a sampler and a matrix.
 */
export interface CSGPolygon3DResolvedPath {
  curvePoints: Curve3DControlPoint[];
  /** The Path3D's global transform, or null when `path_local` is on. */
  baseTransform: Transform3D | null;
}

export interface CSGPolygon3DProperties extends Node3DProperties {
  /** Outline vertices, flat `[x0, y0, x1, y1, …]`. Godot default is a unit square. */
  polygon: Float32Array;
  /** 0 DEPTH, 1 SPIN, 2 PATH. Godot default 0. */
  mode: number;
  /** Extrusion distance for DEPTH. Godot default 1.0. */
  depth: number;
  /** Sweep angle for SPIN. Godot default 360. */
  spinDegrees: number;
  /** Sweep segments for SPIN. Godot default 8. */
  spinSides: number;
  /** Raw `NodePath("…")` to the Path3D for PATH mode. */
  pathNode?: string;
  /** 0 DISTANCE, 1 SUBDIVIDE. Godot default 0. */
  pathIntervalType: number;
  /** Godot default 1.0. */
  pathInterval: number;
  /** Godot default 0.0 (no simplification). */
  pathSimplifyAngle: number;
  /** 0 POLYGON, 1 PATH, 2 PATH_FOLLOW. Godot default **2**. */
  pathRotation: number;
  /** Godot default false. */
  pathRotationAccurate: boolean;
  /** When true the sweep is built in the polygon's own space. Godot default false. */
  pathLocal: boolean;
  /** Godot default true. */
  pathContinuousU: boolean;
  /** Godot default 1.0. */
  pathUDistance: number;
  /** When true the sweep closes on itself and drops the end caps. Godot default false. */
  pathJoined: boolean;
  /** Smooth shading on the WALLS only. Godot default **false** (contrast CSGTorus3D). */
  smoothFaces: boolean;
  /** Reverse winding and negate normals (CSGPrimitive3D). Godot default false. */
  flipFaces: boolean;
  /** Filled in by the scene-wide `path_node` pass, not by the parser. */
  resolvedPath?: CSGPolygon3DResolvedPath;
  /** Material reference (SubResource/ExtResource); StandardMaterial3D in practice. */
  material?: string;
  /** CSG boolean operation: 0 UNION, 1 INTERSECTION, 2 SUBTRACTION. */
  operation?: number;
  /** `cast_shadow` — GeometryInstance3D state (`modules/csg/csg_shape.h:47`). */
  castShadow?: number;
}

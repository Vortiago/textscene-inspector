/**
 * Godot's `Shape3D::get_debug_mesh_lines()` for the shapes the previewer decodes, as flat segment
 * ends the ShapeCast3D gizmo draws (shape_cast_3d.cpp:502-507,
 * shape_cast_3d_gizmo_plugin.cpp:63-67). The circles read the engine's float trig.
 */

import { aabbEdges, centredAabb } from '../../../godot/math/aabb.js';
import { degToRadf } from '../../../godot/math/math.js';
import { storedReal } from '../../../godot/math/real.js';
import type { Vector3 } from '../../../godot/math/vector.js';
import { decodeBoxShape3D } from '../../../resources/shapes/boxshape3d';
import { decodeCapsuleShape3D } from '../../../resources/shapes/capsuleshape3d';
import { decodeConcavePolygonShape3D } from '../../../resources/shapes/concavepolygonshape3d';
import { decodeCylinderShape3D } from '../../../resources/shapes/cylindershape3d';
import { decodeSphereShape3D } from '../../../resources/shapes/sphereshape3d';
import type { TscnInternalResource } from '../../../parser/types';

/** Godot's `AABB::get_edge` (`aabb.cpp:357-416`): the 12 edges of `-size/2, size`, in index order.
 * `BoxShape3D::get_debug_mesh_lines` reads them off its centred box (`box_shape_3d.cpp:36-51`), with
 * each end stored through the `real_t` float the engine keeps.
 *
 * @canonical BoxShape3D's debug wireframe
 */
function boxDebugLines({ x, y, z }: Vector3): Float32Array {
  const edges = aabbEdges(centredAabb({ x, y, z }));
  const points = new Float32Array(edges.length);
  for (let i = 0; i < edges.length; i += 1) points[i] = storedReal(edges[i]!);
  return points;
}

/** One step of a circle in the x/z plane: `sin(deg) * r`, `cos(deg) * r`, each op a `real_t` float. */
/** One step of a circle in the x/z plane. The engine narrows `Math::sin(float)` first (`math_funcs.h:45`), then multiplies in float. */
function ringPoint(radius: number, i: number): [number, number] {
  return [
    storedReal(storedReal(Math.sin(degToRadf(i))) * radius),
    storedReal(storedReal(Math.cos(degToRadf(i))) * radius),
  ];
}

/** `SphereShape3D::get_debug_mesh_lines` (`sphere_shape_3d.cpp:36-59`): three great circles, 361 steps. */
function sphereDebugLines(radius: number): Float32Array {
  const points: number[] = [];
  for (let i = 0; i <= 360; i++) {
    const [ax, ay] = ringPoint(radius, i);
    const [bx, by] = ringPoint(radius, i + 1);
    points.push(ax, 0, ay, bx, 0, by);
    points.push(0, ax, ay, 0, bx, by);
    points.push(ax, ay, 0, bx, by, 0);
  }
  return new Float32Array(points);
}

/** `CylinderShape3D::get_debug_mesh_lines` (`cylinder_shape_3d.cpp:36-57`): two rings, one tick a quarter turn. */
function cylinderDebugLines(radius: number, height: number): Float32Array {
  const points: number[] = [];
  const dy = storedReal(height / 2);
  for (let i = 0; i < 360; i++) {
    const [ax, ay] = ringPoint(radius, i);
    const [bx, by] = ringPoint(radius, i + 1);
    points.push(ax, dy, ay, bx, dy, by);
    points.push(ax, -dy, ay, bx, -dy, by);
    if (i % 90 === 0) points.push(ax, dy, ay, ax, -dy, ay);
  }
  return new Float32Array(points);
}

/** `CapsuleShape3D::get_debug_mesh_lines` (`capsule_shape_3d.cpp:36-61`): rings, ticks and hemisphere seams. */
function capsuleDebugLines(radius: number, height: number): Float32Array {
  const points: number[] = [];
  const dy = storedReal(storedReal(height / 2) - radius);
  for (let i = 0; i < 360; i++) {
    const [ax, ay] = ringPoint(radius, i);
    const [bx, by] = ringPoint(radius, i + 1);
    points.push(ax, dy, ay, bx, dy, by);
    points.push(ax, -dy, ay, bx, -dy, by);
    if (i % 90 === 0) points.push(ax, dy, ay, ax, -dy, ay);
    // `dud` flips at the halfway turn, so the seams trace the near hemisphere, then the far one.
    const seam = i < 180 ? dy : storedReal(-dy);
    points.push(0, storedReal(ax + seam), ay, 0, storedReal(bx + seam), by);
    points.push(ay, storedReal(ax + seam), 0, by, storedReal(bx + seam), 0);
  }
  return new Float32Array(points);
}

/**
 * `ConcavePolygonShape3D::get_debug_mesh_lines` (`concave_polygon_shape_3d.cpp:36-55`): one pair per
 * triangle edge. The dedup reads Godot's `DrawEdge`, which swaps its ends so the larger one leads
 * (`concave_polygon_shape_3d.h:54-59`), and its `==` compares that canonical pair, so a shared edge
 * draws once, its winding never mind. The draw order per edge pairs (larger, smaller).
 */
function concaveDebugLines(faces: Float32Array): Float32Array {
  const seen = new Set<string>();
  const points: number[] = [];
  const vertexText = (slot: number): string =>
    `${faces[slot * 3]},${faces[slot * 3 + 1]},${faces[slot * 3 + 2]}`;
  const lexicographicallyLess = (a: number, b: number): boolean => {
    for (let c = 0; c < 3; c++) {
      const av = faces[a * 3 + c]!;
      const bv = faces[b * 3 + c]!;
      if (av !== bv) return av < bv;
    }
    return false;
  };
  const edge = (a: number, b: number): void => {
    const [larger, smaller] = lexicographicallyLess(a, b) ? [b, a] : [a, b];
    const key = `${vertexText(larger)}|${vertexText(smaller)}`;
    if (seen.has(key)) return;
    seen.add(key);
    for (const slot of [larger, smaller]) {
      points.push(faces[slot * 3]!, faces[slot * 3 + 1]!, faces[slot * 3 + 2]!);
    }
  };
  for (let slot = 0; slot * 3 + 2 * 3 < faces.length; slot += 3) {
    edge(slot, slot + 1);
    edge(slot + 1, slot + 2);
    edge(slot + 2, slot);
  }
  return new Float32Array(points);
}

/**
 * The wireframe of a shape the previewer decodes synchronously. Null for `ConvexPolygonShape3D`,
 * whose lazy hull draws it, and for a type without a port, which the caller warns about.
 *
 * @canonical A shape resource's debug wireframe segments
 */
export function shapeDebugLines(shape: TscnInternalResource): Float32Array | null {
  switch (shape.type) {
    case 'BoxShape3D':
      return boxDebugLines(decodeBoxShape3D(shape.data).size);
    case 'SphereShape3D':
      return sphereDebugLines(decodeSphereShape3D(shape.data).radius);
    case 'CylinderShape3D': {
      const { radius, height } = decodeCylinderShape3D(shape.data);
      return cylinderDebugLines(radius, height);
    }
    case 'CapsuleShape3D': {
      const { radius, height } = decodeCapsuleShape3D(shape.data);
      return capsuleDebugLines(radius, height);
    }
    case 'ConcavePolygonShape3D':
      return concaveDebugLines(decodeConcavePolygonShape3D(shape.data).data);
    default:
      return null;
  }
}

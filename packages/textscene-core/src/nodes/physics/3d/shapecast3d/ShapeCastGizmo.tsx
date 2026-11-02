/**
 * The ShapeCast3D editor gizmo, per shape_cast_3d_gizmo_plugin.cpp:61-67: the origin→target sweep
 * line first, then the shape's debug wireframe at the sweep's end, where the safe fraction of 1 of
 * the editor pose puts it (shape_cast_3d.cpp:504-521). The node's own debug material never varies.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { TscnInternalResource } from '../../../../parser/types';
import { memoisedImport } from '../../../../resources/memoisedImport';
import { useLazyModule } from '../../../../resources/useLazyModule';
import { decodeConvexPolygonShape3D } from '../../../../resources/shapes/convexpolygonshape3d';
import { GizmoLine } from '../../../../r3f/components/GizmoLine';
import { warn } from '../../../../logger';
import type { Rgba } from '../../../../godot/math/math.js';
import type { Vector3 } from '../../../../godot/math/vector.js';
import { castTargetLine } from '../../shared/castTarget';
import { useCastGizmoLook, type CastGizmoLook } from '../../shared/castGizmoLook';
import { UNIT_BOX_SIZE, boxDebugLines, shapeDebugLines } from '../../shared/shapeDebugLines';

/** The one place the gizmo imports three's convex hull, and lazily, as CollisionShape3D's is. */
const loadConvexHull = memoisedImport(() => import('three/addons/math/ConvexHull.js'));

/** A tetrahedron's four corners are the fewest points that enclose a volume. */
const MIN_HULL_POINTS = 4;

interface ShapeCastGizmoProps {
  /** The effective `target_position`, Godot's default when unauthored. */
  target: Vector3;
  /** The resolved shape resource, or null while it is absent or still loading. */
  shape: TscnInternalResource | null;
  /** The authored `debug_shape_custom_color`, undefined when unauthored. */
  customColor?: Rgba;
  /** Whether the sweep casts. Godot default true, per shape_cast_3d.h:43. */
  enabled: boolean;
}

export function ShapeCastGizmo({ target, shape, customColor, enabled }: ShapeCastGizmoProps) {
  const look = useCastGizmoLook(customColor, enabled);
  const line = useMemo(() => castTargetLine(target), [target]);
  return (
    <>
      {line && <GizmoLine positions={line} color={look.color} opacity={look.opacity} />}
      {shape && <ShapeWireframe shape={shape} target={target} look={look} />}
    </>
  );
}

interface ShapeWireframeProps {
  shape: TscnInternalResource;
  target: Vector3;
  look: CastGizmoLook;
}

/** The shape's wireframe beside the sweep line, from Godot's `get_debug_mesh_lines` port. */
function ShapeWireframe({ shape, target, look }: ShapeWireframeProps) {
  return shape.type === 'ConvexPolygonShape3D' ? (
    <ConvexHullWireframe shape={shape} target={target} look={look} />
  ) : (
    <SyncWireframe shape={shape} target={target} look={look} />
  );
}

interface WireframeGizmoProps {
  target: Vector3;
  look: CastGizmoLook;
}

/** The wireframe Godot's sync debug-line ports draw, or the unit box a type without a port falls back to. */
function SyncWireframe({ shape, target, look }: WireframeGizmoProps & { shape: TscnInternalResource }) {
  const wire = useMemo(() => {
    const lines = shapeDebugLines(shape);
    if (lines) return lines;
    // Godot draws every Shape3D type; without a port, the shape's presence still shows.
    warn(`[ShapeCast3D] Unsupported shape type "${shape.type}", drawing a unit wireframe box.`);
    return boxDebugLines(UNIT_BOX_SIZE);
  }, [shape]);
  return <Wireframe wire={wire} target={target} look={look} />;
}

/**
 * The wireframe of a convex shape: the hull's face outlines, through the lazy ConvexHull, as
 * CollisionShape3D hulls load off the initial paint too. Nothing draws while it loads.
 */
function ConvexHullWireframe({ shape, target, look }: WireframeGizmoProps & { shape: TscnInternalResource }) {
  const hull = useLazyModule(loadConvexHull);
  const edges = useMemo(() => buildHullEdges(shape, hull), [hull, shape]);
  return <Wireframe wire={edges} target={target} look={look} />;
}

/** The hull's face outlines from `ConvexPolygonShape3D::get_debug_mesh_lines` port, or null while loading or for a thin cloud. */
function buildHullEdges(
  shape: TscnInternalResource,
  hull: Awaited<ReturnType<typeof loadConvexHull>> | null
): Float32Array | null {
  if (!hull) return null;
  const { ConvexHull } = hull;
  try {
    const points = decodeConvexPolygonShape3D(shape.data).points;
    const vertices: THREE.Vector3[] = [];
    for (let i = 0; i + 2 < points.length; i += 3) {
      vertices.push(new THREE.Vector3(points[i]!, points[i + 1]!, points[i + 2]!));
    }
    if (vertices.length < MIN_HULL_POINTS) return null;
    const built = new ConvexHull().setFromPoints(vertices);
    // ConvexHullComputer copies one edge per canonical pair of the triangulated hull
    // (convex_hull.cpp:2275-2283), so the face loops dedup by an either-order pair key.
    const seen = new Set<string>();
    const outline: number[] = [];
    for (const face of built.faces) {
      let edge = face.edge;
      do {
        const vertex = edge.head().point;
        const next = edge.next.head().point;
        const key = `${vertex.x},${vertex.y},${vertex.z}|${next.x},${next.y},${next.z}`;
        const mirrored = `${next.x},${next.y},${next.z}|${vertex.x},${vertex.y},${vertex.z}`;
        if (!seen.has(key) && !seen.has(mirrored)) {
          seen.add(key);
          outline.push(vertex.x, vertex.y, vertex.z, next.x, next.y, next.z);
        }
        edge = edge.next;
      } while (edge !== face.edge);
    }
    return outline.length === 0 ? null : new Float32Array(outline);
  } catch (error) {
    // A hull the engine refuses, four coplanar points among them, draws nothing here either.
    warn(
      `[ShapeCast3D] Failed to build convex hull gizmo: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

/** The built wireframe at the sweep's end: each vertex plus the whole target. */
function Wireframe({ wire, target, look }: WireframeGizmoProps & { wire: Float32Array | null }) {
  const offset = useMemo(() => {
    // The wireframe sits at the sweep's end, where the editor pose's safe fraction of 1 puts it
    // (shape_cast_3d.cpp:508-513).
    if (!wire) return null;
    return offsetByTarget(wire, target);
  }, [wire, target]);
  if (!offset) return null;
  return <GizmoLine positions={offset} color={look.color} opacity={look.opacity} />;
}

/** Each wireframe vertex plus the target, the offset Godot's loop applies componentwise. */
function offsetByTarget(lines: Float32Array, { x, y, z }: Vector3): Float32Array {
  const offset = new Float32Array(lines.length);
  for (let i = 0; i < lines.length; i += 3) {
    offset[i] = lines[i]! + x;
    offset[i + 1] = lines[i + 1]! + y;
    offset[i + 2] = lines[i + 2]! + z;
  }
  return offset;
}

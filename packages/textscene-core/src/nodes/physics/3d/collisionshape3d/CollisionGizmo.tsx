/**
 * Wireframe gizmo for a collision-shape resource, drawn in the node's `debug_color` like
 * Godot's editor collision overlay. CollisionShape3D mounts it only when `showCollisions` is on.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { Shape3DResource } from '../../../../resources/shapes/shape3d';
import { useConvexDebugLines } from '../../shared/useConvexDebugLines';
import { shapeDebugLines } from '../../shared/shapeDebugLines';
import { GizmoLine } from '../../../../r3f/components/GizmoLine';

interface CollisionGizmoProps {
  shape: Shape3DResource;
  /** The node's `debug_color`, already resolved to a three colour. */
  color: THREE.Color;
}

export function CollisionGizmo({ shape, color }: CollisionGizmoProps) {
  switch (shape.type) {
    case 'BoxShape3D':
    case 'CapsuleShape3D':
    case 'SphereShape3D':
    case 'CylinderShape3D':
    case 'WorldBoundaryShape3D':
    case 'HeightMapShape3D':
    case 'SeparationRayShape3D':
    case 'ConcavePolygonShape3D':
      return <ShapeLines shape={shape} color={color} />;
    case 'ConvexPolygonShape3D':
      return <ConvexHullLines shape={shape} color={color} />;
  }
}

/** The lines of Godot's `get_debug_mesh_lines()`, which its editor collision overlay draws for a shape. */
function ShapeLines({ shape, color }: { shape: Shape3DResource; color: THREE.Color }) {
  const positions = useMemo(() => shapeDebugLines(shape), [shape]);
  return positions && <GizmoLine positions={positions} color={color} />;
}

/** The hull edges of a convex shape, which draw once the lazy hull builder loads. */
function ConvexHullLines({ shape, color }: { shape: Shape3DResource; color: THREE.Color }) {
  const positions = useConvexDebugLines(shape);
  return positions && <GizmoLine positions={positions} color={color} />;
}

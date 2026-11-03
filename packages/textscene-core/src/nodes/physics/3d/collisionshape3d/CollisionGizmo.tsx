/**
 * Wireframe gizmo for a collision-shape resource, drawn in the node's `debug_color` like
 * Godot's editor collision overlay. CollisionShape3D mounts it only when `showCollisions` is on.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { TscnInternalResource } from '../../../../parser/types';
import { decodeConvexPolygonShape3D } from '../../../../resources/shapes/convexpolygonshape3d';
import { decodeConcavePolygonShape3D } from '../../../../resources/shapes/concavepolygonshape3d';
import { shapeDebugLines } from '../../shared/shapeDebugLines';
import { GizmoLine } from '../../../../r3f/components/GizmoLine';
import { warn } from '../../../../logger';
import { wireGizmoProgram } from '../../../../r3f/components/wireGizmoProgram';
import { useDisposeOnRelease } from '../../../../r3f/useDisposeOnRelease';
import { memoisedImport } from '../../../../resources/memoisedImport';
import { useLazyModule } from '../../../../resources/useLazyModule';

interface CollisionGizmoProps {
  shape: TscnInternalResource;
  /** The node's `debug_color`, already resolved to a three colour. */
  color: THREE.Color;
}

export function CollisionGizmo({ shape, color }: CollisionGizmoProps) {
  const data = shape.data;
  const wire = wireGizmoProgram(color);
  switch (shape.type) {
    case 'BoxShape3D':
    case 'CapsuleShape3D':
    case 'SphereShape3D':
    case 'CylinderShape3D':
    case 'WorldBoundaryShape3D':
      return <ShapeLines shape={shape} color={color} />;
    case 'ConcavePolygonShape3D':
      return <TriangleSoupWire shapeData={data} color={color} />;
    case 'ConvexPolygonShape3D':
      return <ConvexHullWire shapeData={data} color={color} />;
    default:
      warn(`[CollisionShape3D] Unsupported shape type "${shape.type}": drawing a unit wireframe box.`);
      return (
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial key={wire.key} {...wire.props} />
        </mesh>
      );
  }
}

interface ShapeWireProps {
  /**
   * The shape resource's property bag, whose identity holds across renders. A decode per render
   * hands back a new array, and each new array would rebuild the geometry.
   */
  shapeData: Record<string, string>;
  color: THREE.Color;
}

/** One triangle, three vertices of three floats each: the least a triangle soup can draw. */
const MIN_TRIANGLE_SOUP_FLOATS = 3 * 3;

/** A tetrahedron's four corners: the fewest points that enclose a volume. */
const MIN_CONVEX_HULL_POINTS = 4;

/** The lines of Godot's `get_debug_mesh_lines()`, which its editor collision overlay draws for a shape. */
function ShapeLines({ shape, color }: { shape: TscnInternalResource; color: THREE.Color }) {
  const positions = useMemo(() => shapeDebugLines(shape), [shape]);
  return positions && <GizmoLine positions={positions} color={color} />;
}

/** A concave shape is already a triangle soup, bound as a non-indexed BufferGeometry. */
function TriangleSoupWire({ shapeData, color }: ShapeWireProps) {
  const geometry = useMemo(() => {
    const { data } = decodeConcavePolygonShape3D(shapeData);
    if (data.length < MIN_TRIANGLE_SOUP_FLOATS) return null;
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(data, 3));
    return geom;
  }, [shapeData]);
  useDisposeOnRelease(geometry);
  const wire = wireGizmoProgram(color);
  if (!geometry) return null;
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial key={wire.key} {...wire.props} />
    </mesh>
  );
}

/**
 * `ConvexGeometry` lives in three's examples bundle, so it loads on demand: it stays off the
 * static-paint closure and out of the VS Code webview budget until collisions show.
 */
const loadConvexGeometry = memoisedImport(() => import('three/addons/geometries/ConvexGeometry.js'));

/** Convex hull from a point cloud, through the lazy-loaded ConvexGeometry. */
function ConvexHullWire({ shapeData, color }: ShapeWireProps) {
  const hullModule = useLazyModule(loadConvexGeometry);
  const geometry = useMemo(() => {
    if (!hullModule) return null;
    const { points } = decodeConvexPolygonShape3D(shapeData);
    const verts: THREE.Vector3[] = [];
    for (let i = 0; i + 2 < points.length; i += 3) {
      verts.push(new THREE.Vector3(points[i], points[i + 1], points[i + 2]));
    }
    if (verts.length < MIN_CONVEX_HULL_POINTS) return null;
    return new hullModule.ConvexGeometry(verts);
  }, [hullModule, shapeData]);
  useDisposeOnRelease(geometry);

  const wire = wireGizmoProgram(color);
  if (!geometry) return null;
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial key={wire.key} {...wire.props} />
    </mesh>
  );
}

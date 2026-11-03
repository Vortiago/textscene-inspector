/**
 * Wireframe gizmo for a collision-shape resource, drawn in the node's `debug_color` like
 * Godot's editor collision overlay. CollisionShape3D mounts it only when `showCollisions` is on.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { TscnInternalResource } from '../../../../parser/types';
import { decodeBoxShape3D } from '../../../../resources/shapes/boxshape3d';
import { decodeConvexPolygonShape3D } from '../../../../resources/shapes/convexpolygonshape3d';
import { decodeConcavePolygonShape3D } from '../../../../resources/shapes/concavepolygonshape3d';
import { decodeCapsuleShape3D } from '../../../../resources/shapes/capsuleshape3d';
import { decodeSphereShape3D } from '../../../../resources/shapes/sphereshape3d';
import { decodeCylinderShape3D } from '../../../../resources/shapes/cylindershape3d';
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
    case 'BoxShape3D': {
      const { size } = decodeBoxShape3D(data);
      return (
        <mesh>
          <boxGeometry args={[size.x, size.y, size.z]} />
          <meshBasicMaterial key={wire.key} {...wire.props} />
        </mesh>
      );
    }
    case 'CapsuleShape3D': {
      const { radius, height } = decodeCapsuleShape3D(data);
      return (
        <mesh>
          {/* Godot's `height` spans the whole capsule; three's `length` is only
              the cylindrical section between the two hemispheres. */}
          <capsuleGeometry args={[radius, height - radius * 2, 4, 16]} />
          <meshBasicMaterial key={wire.key} {...wire.props} />
        </mesh>
      );
    }
    case 'SphereShape3D':
      return (
        <mesh>
          <sphereGeometry args={[decodeSphereShape3D(data).radius, 16, 12]} />
          <meshBasicMaterial key={wire.key} {...wire.props} />
        </mesh>
      );
    case 'CylinderShape3D': {
      const { radius, height } = decodeCylinderShape3D(data);
      return (
        <mesh>
          <cylinderGeometry args={[radius, radius, height, 16]} />
          <meshBasicMaterial key={wire.key} {...wire.props} />
        </mesh>
      );
    }
    case 'ConcavePolygonShape3D':
      return <TriangleSoupWire shapeData={data} color={color} />;
    case 'ConvexPolygonShape3D':
      return <ConvexHullWire shapeData={data} color={color} />;
    default:
      warn(`[CollisionShape3D] Unsupported shape type "${shape.type}" — drawing a unit wireframe box.`);
      return (
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial key={wire.key} {...wire.props} />
        </mesh>
      );
  }
}

interface PolygonWireProps {
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

/** A concave shape is already a triangle soup, bound as a non-indexed BufferGeometry. */
function TriangleSoupWire({ shapeData, color }: PolygonWireProps) {
  const geometry = useMemo(() => {
    const { data } = decodeConcavePolygonShape3D(shapeData);
    if (data.length < MIN_TRIANGLE_SOUP_FLOATS) return null;
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(data, 3));
    geom.computeVertexNormals();
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
function ConvexHullWire({ shapeData, color }: PolygonWireProps) {
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

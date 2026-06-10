/**
 * Wireframe gizmo for a collision-shape resource. Renders the shape's geometry
 * as a green wireframe (mirrors Godot's editor collision overlay). Only mounted
 * when `showCollisions` is on (see CollisionShape3D), so it costs nothing by
 * default.
 *
 * `ConvexPolygonShape3D` builds a `ConvexGeometry`, which lives in three's
 * examples bundle — it is lazy-`import()`ed so it stays OFF the static-paint
 * closure and out of the VS Code webview budget until collisions are toggled on.
 */

import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { TscnInternalResource } from '../../../../parser/types';
import { parseBoxShape3D } from '../../../../resources/shapes/boxshape3d/parser';
import { parseConvexPolygonShape3D } from '../../../../resources/shapes/convexpolygonshape3d/parser';
import { parseConcavePolygonShape3D } from '../../../../resources/shapes/concavepolygonshape3d/parser';
import { warn } from '../../../../logger';

const WIRE_COLOR = 0x00ff88;

export function CollisionGizmo({ shape }: { shape: TscnInternalResource }) {
  const data = shape.data as Record<string, string>;
  switch (shape.type) {
    case 'BoxShape3D': {
      const { size } = parseBoxShape3D(data);
      return (
        <mesh>
          <boxGeometry args={[size.x, size.y, size.z]} />
          <meshBasicMaterial color={WIRE_COLOR} wireframe />
        </mesh>
      );
    }
    case 'ConcavePolygonShape3D':
      return <TriangleSoupWire data={parseConcavePolygonShape3D(data).data} />;
    case 'ConvexPolygonShape3D':
      return <ConvexHullWire points={parseConvexPolygonShape3D(data).points} />;
    default:
      warn(`[CollisionShape3D] Unsupported shape type "${shape.type}" — drawing a unit wireframe box.`);
      return (
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color={WIRE_COLOR} wireframe />
        </mesh>
      );
  }
}

/** Concave shapes are already a triangle soup — bind it as a non-indexed BufferGeometry. */
function TriangleSoupWire({ data }: { data: Float32Array }) {
  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(data, 3));
    geom.computeVertexNormals();
    return geom;
  }, [data]);
  if (data.length < 9) return null;
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial color={WIRE_COLOR} wireframe />
    </mesh>
  );
}

/** Convex hull from a point cloud — ConvexGeometry is lazy-loaded (bundle budget). */
function ConvexHullWire({ points }: { points: Float32Array }) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);

  useEffect(() => {
    let cancelled = false;
    const verts: THREE.Vector3[] = [];
    for (let i = 0; i + 2 < points.length; i += 3) {
      verts.push(new THREE.Vector3(points[i], points[i + 1], points[i + 2]));
    }
    if (verts.length < 4) {
      setGeometry(null);
      return;
    }
    void import('three/addons/geometries/ConvexGeometry.js')
      .then(({ ConvexGeometry }) => {
        if (!cancelled) setGeometry(new ConvexGeometry(verts));
      })
      .catch((error) => {
        warn(`[CollisionShape3D] Failed to build convex hull gizmo: ${String(error)}`);
      });
    return () => {
      cancelled = true;
    };
  }, [points]);

  if (!geometry) return null;
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial color={WIRE_COLOR} wireframe />
    </mesh>
  );
}

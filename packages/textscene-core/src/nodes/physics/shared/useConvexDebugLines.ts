/**
 * The debug lines of a ConvexPolygonShape3D for both gizmos that draw it. The hull builder lives in
 * three's examples bundle, so it loads on demand: it stays off the static-paint closure and out of
 * the VS Code webview budget until a gizmo shows. Null until it loads.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { TscnInternalResource } from '../../../parser/types';
import { decodeConvexPolygonShape3D } from '../../../resources/shapes/convexpolygonshape3d';
import { memoisedImport } from '../../../resources/memoisedImport';
import { useLazyModule } from '../../../resources/useLazyModule';
import { convexDebugLines } from './convexDebugLines';

const loadConvexGeometry = memoisedImport(() => import('three/addons/geometries/ConvexGeometry.js'));

function toVector3s(points: Float32Array): THREE.Vector3[] {
  const vectors: THREE.Vector3[] = [];
  for (let i = 0; i + 2 < points.length; i += 3) {
    vectors.push(new THREE.Vector3(points[i], points[i + 1], points[i + 2]));
  }
  return vectors;
}

/**
 * The hull edges of the shape's points, empty for a single point. `shape` must hold its identity
 * across renders: a new one rebuilds the hull.
 *
 * @canonical A ConvexPolygonShape3D's debug lines, loaded lazily
 */
export function useConvexDebugLines(shape: TscnInternalResource): Float32Array | null {
  const hullModule = useLazyModule(loadConvexGeometry);
  return useMemo(() => {
    if (!hullModule) return null;
    const { points } = decodeConvexPolygonShape3D(shape.data);
    const hull = new hullModule.ConvexGeometry(toVector3s(points));
    const lines = convexDebugLines(points, hull.getAttribute('position').array);
    hull.dispose();
    return lines.length > 0 ? lines : null;
  }, [hullModule, shape]);
}

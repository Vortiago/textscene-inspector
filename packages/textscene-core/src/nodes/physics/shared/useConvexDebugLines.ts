/**
 * The debug lines of a ConvexPolygonShape3D for both gizmos that draw it. The hull builder lives in
 * three's examples bundle, so it loads on demand: it stays off the static-paint closure and out of
 * the VS Code webview budget until a gizmo shows. Null until it loads.
 */

import { useMemo } from 'react';
import type { TscnInternalResource } from '../../../parser/types';
import { decodeConvexPolygonShape3D } from '../../../resources/shapes/convexpolygonshape3d';
import { memoisedImport } from '../../../resources/memoisedImport';
import { useLazyModule } from '../../../resources/useLazyModule';
import { convexDebugLines } from './convexDebugLines';

const loadConvexGeometry = memoisedImport(() => import('three/addons/geometries/ConvexGeometry.js'));

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
    const lines = convexDebugLines(decodeConvexPolygonShape3D(shape.data).points, hullModule.ConvexGeometry);
    return lines.length > 0 ? lines : null;
  }, [hullModule, shape]);
}

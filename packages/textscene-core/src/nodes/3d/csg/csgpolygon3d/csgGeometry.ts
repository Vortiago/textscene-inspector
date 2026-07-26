/** CSGPolygon3D's solid, exposed to the boolean evaluator. */

import * as THREE from 'three';
import type { CsgGeometryBuilder } from '../../../../r3f/csg/csgRegistration';
import { transform3DToMatrix } from '../../../../r3f/nodeTreeTransforms';
import { tessellateCurve3D } from '../../../../resources/shapes/curve3d';
import { buildCsgPolygonGeometry, PolygonMode, type CsgPolygonPathPlan } from './polygonGeometry';
import type { CSGPolygon3DProperties } from './types';

function pathPlan(p: CSGPolygon3DProperties): CsgPolygonPathPlan | null {
  if (p.mode !== PolygonMode.PATH || !p.resolvedPath) return null;
  const sampler = tessellateCurve3D(p.resolvedPath.curvePoints);
  if (sampler.length <= 0) return null;
  return {
    sampler,
    baseMatrix: p.resolvedPath.baseTransform
      ? transform3DToMatrix(p.resolvedPath.baseTransform)
      : null,
    // `Curve3D.point_count`, which PATH_INTERVAL_SUBDIVIDE counts in.
    pointCount: p.resolvedPath.curvePoints.length,
  };
}

export const csgPolygon3DGeometry: CsgGeometryBuilder = (properties): THREE.BufferGeometry => {
  const p = properties as unknown as CSGPolygon3DProperties;
  return buildCsgPolygonGeometry({
    polygon: p.polygon,
    mode: p.mode,
    depth: p.depth,
    spinDegrees: p.spinDegrees,
    spinSides: p.spinSides,
    smoothFaces: p.smoothFaces,
    flipFaces: p.flipFaces,
    pathIntervalType: p.pathIntervalType,
    pathInterval: p.pathInterval,
    pathSimplifyAngle: p.pathSimplifyAngle,
    pathRotation: p.pathRotation,
    pathRotationAccurate: p.pathRotationAccurate,
    pathContinuousU: p.pathContinuousU,
    pathUDistance: p.pathUDistance,
    pathJoined: p.pathJoined,
    path: pathPlan(p),
  });
};

export function csgPolygon3DGeometryKey(properties: Record<string, unknown>): string {
  const p = properties as unknown as CSGPolygon3DProperties;
  // The resolved curve is part of the shape, so its points belong in the key; the pass
  // rewrites `resolvedPath` on every reparse, so identity alone would never match.
  const curve = p.resolvedPath
    ? p.resolvedPath.curvePoints
        .map((c) => `${c.position.x},${c.position.y},${c.position.z}`)
        .join(';')
    : '';
  return [
    'poly',
    Array.from(p.polygon).join(','),
    p.mode,
    p.depth,
    p.spinDegrees,
    p.spinSides,
    p.smoothFaces,
    p.flipFaces,
    p.pathIntervalType,
    p.pathInterval,
    p.pathSimplifyAngle,
    p.pathRotation,
    p.pathRotationAccurate,
    p.pathContinuousU,
    p.pathUDistance,
    p.pathJoined,
    curve,
  ].join('|');
}

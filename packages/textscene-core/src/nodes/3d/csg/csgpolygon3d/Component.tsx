/**
 * <CSGPolygon3D> — a 2D outline swept into a solid: extruded, revolved, or run along a
 * Path3D. The sweep itself is a port of Godot's brush construction; see
 * `polygonGeometry.ts` for why nothing three ships substitutes for it.
 *
 * PATH mode needs a curve that lives on a DIFFERENT node, which a component cannot reach:
 * `path_node` resolves to a sibling in the corpus's Road scenes and to a child in
 * `racetrack_csg.tscn`. The scene-wide pass in `r3f/csgPolygonPaths.ts` resolves it after
 * parse and writes plain data onto `resolvedPath`, so the tree viewer, inspector, bounds
 * and the boolean evaluator all see the same answer rather than each recomputing it.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { transform3DToMatrix } from '../../../../r3f/nodeTreeTransforms';
import { tessellateCurve3D } from '../../../../resources/shapes/curve3d';
import { CsgPrimitive } from '../CsgPrimitive';
import { buildCsgPolygonGeometry, PolygonMode, type CsgPolygonPathPlan } from './polygonGeometry';
import type { CSGPolygon3DProperties } from './types';

export function CSGPolygon3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as CSGPolygon3DProperties;
  const { resolvedPath } = properties;

  const path = useMemo<CsgPolygonPathPlan | null>(() => {
    if (properties.mode !== PolygonMode.PATH || !resolvedPath) return null;
    const sampler = tessellateCurve3D(resolvedPath.curvePoints);
    if (sampler.length <= 0) return null;
    return {
      sampler,
      baseMatrix: resolvedPath.baseTransform ? transform3DToMatrix(resolvedPath.baseTransform) : null,
      pointCount: resolvedPath.pointCount,
    };
  }, [properties.mode, resolvedPath]);

  const geometry = useMemo(
    () =>
      buildCsgPolygonGeometry({
        polygon: properties.polygon,
        mode: properties.mode,
        depth: properties.depth,
        spinDegrees: properties.spinDegrees,
        spinSides: properties.spinSides,
        smoothFaces: properties.smoothFaces,
        flipFaces: properties.flipFaces,
        pathIntervalType: properties.pathIntervalType,
        pathInterval: properties.pathInterval,
        pathSimplifyAngle: properties.pathSimplifyAngle,
        pathRotation: properties.pathRotation,
        pathRotationAccurate: properties.pathRotationAccurate,
        pathContinuousU: properties.pathContinuousU,
        pathUDistance: properties.pathUDistance,
        pathJoined: properties.pathJoined,
        path,
      }),
    // Scalar deps plus the two structural inputs, not the properties object: the parser
    // allocates a fresh one per reparse, so identity would rebuild every keystroke.
    [
      properties.polygon,
      properties.mode,
      properties.depth,
      properties.spinDegrees,
      properties.spinSides,
      properties.smoothFaces,
      properties.flipFaces,
      properties.pathIntervalType,
      properties.pathInterval,
      properties.pathSimplifyAngle,
      properties.pathRotation,
      properties.pathRotationAccurate,
      properties.pathContinuousU,
      properties.pathUDistance,
      properties.pathJoined,
      path,
    ]
  );

  return (
    <CsgPrimitive
      node={node}
      properties={properties}
      geometry={<primitive object={geometry as THREE.BufferGeometry} attach="geometry" />}
    >
      {children}
    </CsgPrimitive>
  );
}

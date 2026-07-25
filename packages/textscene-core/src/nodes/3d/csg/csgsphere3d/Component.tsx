/**
 * <CSGSphere3D> — renders a Godot CSGSphere3D as a solid sphere.
 *
 * Geometry comes from `buildCsgSphereGeometry`, a port of Godot's own brush construction,
 * rather than three's `SphereGeometry`. Godot walks latitude from the north pole down,
 * gives sin to X and cos to Z, and collapses each pole to one shared vertex whose normal
 * is the average of every face meeting it. Those are the same divergences that put the
 * CSGCylinder3D cone 0.788% away from real Godot.
 */

import { useMemo } from 'react';
import type { CSGSphere3DProperties } from './types';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { CsgPrimitive } from '../CsgPrimitive';
import { buildCsgSphereGeometry } from './sphereGeometry';

export function CSGSphere3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as CSGSphere3DProperties;
  const { radius, radialSegments, rings, smoothFaces, flipFaces } = properties;

  // Keyed on the scalars the builder reads, not on the properties object: the parser
  // allocates a fresh one per reparse, so identity would rebuild on every keystroke.
  const geometry = useMemo(
    () => buildCsgSphereGeometry({ radius, radialSegments, rings, smoothFaces, flipFaces }),
    [radius, radialSegments, rings, smoothFaces, flipFaces]
  );

  return (
    <CsgPrimitive
      node={node}
      properties={properties}
      geometry={<primitive object={geometry} attach="geometry" />}
    >
      {children}
    </CsgPrimitive>
  );
}

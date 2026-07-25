/**
 * <CSGCylinder3D> — renders a Godot CSGCylinder3D as a solid cylinder (or cone).
 *
 * Geometry comes from `buildCsgCylinderGeometry`, a port of Godot's own brush
 * construction, rather than from three's `CylinderGeometry`. The two differ at a cone's
 * collapsed apex, where three gives one radial normal per segment and Godot averages them
 * into one; measured against real Godot 4.6.3 that was worth 0.788% on
 * `unit-csg-cylinder.tscn`, 7.9x the visual gate.
 */

import { useMemo } from 'react';
import type { CSGCylinder3DProperties } from './types';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { CsgPrimitive } from '../CsgPrimitive';
import { buildCsgCylinderGeometry } from './cylinderGeometry';

export function CSGCylinder3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as CSGCylinder3DProperties;
  const { radius, height, sides, cone, smoothFaces, flipFaces } = properties;

  // Keyed on the scalars the builder actually reads: the parser allocates a fresh
  // properties object per reparse, so memoizing on identity would rebuild (and never
  // dispose) the geometry on every keystroke in the source pane.
  const geometry = useMemo(
    () => buildCsgCylinderGeometry({ radius, height, sides, cone, smoothFaces, flipFaces }),
    [radius, height, sides, cone, smoothFaces, flipFaces]
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

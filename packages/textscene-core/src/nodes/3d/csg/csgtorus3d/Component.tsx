/**
 * <CSGTorus3D> — renders a Godot CSGTorus3D as a solid ring.
 *
 * Geometry is a port of Godot's own brush construction rather than a mapping onto
 * `THREE.TorusGeometry`, which would have to reconcile two axis conventions and two
 * opposite meanings of "radial segments". See `torusGeometry.ts`.
 */

import { useMemo } from 'react';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { CsgPrimitive } from '../CsgPrimitive';
import { buildCsgTorusGeometry } from './torusGeometry';
import type { CSGTorus3DProperties } from './types';

export function CSGTorus3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as CSGTorus3DProperties;
  const { innerRadius, outerRadius, sides, ringSides, smoothFaces, flipFaces } = properties;

  // Keyed on the scalars the builder reads, not the properties object: the parser
  // allocates a fresh one per reparse, so identity would rebuild on every keystroke.
  const geometry = useMemo(
    () => buildCsgTorusGeometry({ innerRadius, outerRadius, sides, ringSides, smoothFaces, flipFaces }),
    [innerRadius, outerRadius, sides, ringSides, smoothFaces, flipFaces]
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

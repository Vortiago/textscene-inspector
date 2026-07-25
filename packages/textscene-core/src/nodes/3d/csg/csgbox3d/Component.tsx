/**
 * <CSGBox3D> — renders a Godot CSGBox3D as a solid box.
 *
 * Geometry comes from `buildCsgBoxGeometry`, the same builder the boolean evaluator
 * calls, so the box a scene draws on its own and the box it contributes to a subtraction
 * are the same triangles with the same UVs and the same normals.
 */

import { useMemo } from 'react';
import type { CSGBox3DProperties } from './types';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { CsgPrimitive } from '../CsgPrimitive';
import { buildCsgBoxGeometry } from './boxGeometry';

export function CSGBox3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as CSGBox3DProperties;
  const { x, y, z } = properties.size;
  const flipFaces = properties.flipFaces;

  // Keyed on the scalars the builder reads, not the properties object: the parser
  // allocates a fresh one per reparse, so identity would rebuild on every keystroke.
  const geometry = useMemo(
    () => buildCsgBoxGeometry({ size: { x, y, z }, flipFaces }),
    [x, y, z, flipFaces]
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

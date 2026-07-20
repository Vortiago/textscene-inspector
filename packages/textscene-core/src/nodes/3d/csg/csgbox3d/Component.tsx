/**
 * <CSGBox3D> — renders a Godot CSGBox3D as a solid box primitive.
 *
 * ADR-0004: the boolean `operation` is parsed but never applied, so a
 * subtraction or intersection renders as a solid block. That IS visible on the
 * vendored corpus — 36 non-union CSG nodes across five scenes — and is not the
 * corpus-safe simplification this comment used to claim. Scaffold lives in the
 * shared <CsgPrimitive>.
 */

import type { CSGBox3DProperties } from './types';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { CsgPrimitive } from '../CsgPrimitive';

export function CSGBox3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as CSGBox3DProperties;
  const { x, y, z } = properties.size;

  return (
    <CsgPrimitive node={node} properties={properties} geometry={<boxGeometry args={[x, y, z]} />}>
      {children}
    </CsgPrimitive>
  );
}

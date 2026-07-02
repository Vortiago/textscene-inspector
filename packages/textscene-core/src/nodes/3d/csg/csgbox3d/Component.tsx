/**
 * <CSGBox3D> — renders a Godot CSGBox3D as a solid box primitive.
 *
 * For ld-58 the ADR-0004 base-primitive rendering is exact (every CSG node
 * uses the default union). Scaffold lives in the shared <CsgPrimitive>.
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

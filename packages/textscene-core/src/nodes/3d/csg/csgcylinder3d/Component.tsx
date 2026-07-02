/**
 * <CSGCylinder3D> — renders a Godot CSGCylinder3D as a solid cylinder (or cone).
 *
 * `cone=true` collapses the top radius to 0. Scaffold lives in the shared
 * <CsgPrimitive> (ADR-0004 base-primitive rendering).
 */

import type { CSGCylinder3DProperties } from './types';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { CsgPrimitive } from '../CsgPrimitive';

export function CSGCylinder3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as CSGCylinder3DProperties;
  const topRadius = properties.cone ? 0 : properties.radius;

  return (
    <CsgPrimitive
      node={node}
      properties={properties}
      geometry={
        <cylinderGeometry
          args={[topRadius, properties.radius, properties.height, properties.sides]}
        />
      }
    >
      {children}
    </CsgPrimitive>
  );
}

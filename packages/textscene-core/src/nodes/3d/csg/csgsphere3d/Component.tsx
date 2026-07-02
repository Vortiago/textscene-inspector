/**
 * <CSGSphere3D> — renders a Godot CSGSphere3D as a solid sphere primitive.
 *
 * `radial_segments`/`rings` map to three.js width/height segments. Scaffold
 * lives in the shared <CsgPrimitive> (ADR-0004 base-primitive rendering).
 */

import type { CSGSphere3DProperties } from './types';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { CsgPrimitive } from '../CsgPrimitive';

export function CSGSphere3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as CSGSphere3DProperties;

  return (
    <CsgPrimitive
      node={node}
      properties={properties}
      geometry={
        <sphereGeometry args={[properties.radius, properties.radialSegments, properties.rings]} />
      }
    >
      {children}
    </CsgPrimitive>
  );
}

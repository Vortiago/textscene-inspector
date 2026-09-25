/**
 * <Node>: the base Godot Node, and the fallback type for a node with no `type` attribute, such as
 * an instance-only `[node name="Crate" instance=ExtResource("...")]`. It renders children in a
 * `<group>` and applies `properties.transform` through `transformFromNode3DProperties`, as Node3D
 * does. With no transform the helper returns identity, so the group is a no-op.
 */

import { useMemo } from 'react';
import type { NodeProperties } from './types';
import type { NodeComponentProps } from '../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../r3f/nodeTransform';

export function Node({ node, children }: NodeComponentProps) {
  // The base Node parser populates `transform` on Node3D-derived
  // instance nodes; `transformFromNode3DProperties` accepts the
  // Node3DProperties superset, which includes the `transform?` slot
  // that NodeProperties shares. Identity transform when absent.
  const props = node.properties as NodeProperties;
  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(props),
    [props]
  );
  return (
    <group
      name={node.name}
      position={position}
      rotation={rotation}
      scale={scale}
    >
      {children}
    </group>
  );
}

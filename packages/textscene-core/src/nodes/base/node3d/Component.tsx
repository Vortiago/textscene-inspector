/**
 * <Node3D>: an invisible transform container that applies the Godot Transform3D to a <group>, as
 * position, rotation and scale, or as the whole matrix for a sheared basis.
 */

import { useMemo, type Ref } from 'react';
import type * as THREE from 'three';
import type { Node3DProperties } from './types';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { invisibleBase } from '../../../r3f/invisibleBase';
import { node3dGroupSpread, transformFromNode3DProperties } from '../../../r3f/nodeTransform';

export function Node3D({ node, children, ref }: NodeComponentProps & { ref?: Ref<THREE.Group> }) {
  const props = node.properties as Node3DProperties;
  const transform = useMemo(() => transformFromNode3DProperties(props), [props]);
  // paint-order-safe: 3D content, which the canvas key never reaches. Only the
  // 2D canvas gives `groupOrder` a value.
  return (
    <group ref={ref} name={node.name} {...node3dGroupSpread(transform)}>
      {children}
    </group>
  );
}

invisibleBase(Node3D);

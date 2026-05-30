/**
 * <Node3D> — invisible transform container.
 * Decomposes the Godot Transform3D matrix into position/rotation/scale on a <group>.
 */

import { useMemo } from 'react';
import type { Node3DProperties } from './types';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../r3f/nodeTransform';

export function Node3D({ node, children }: NodeComponentProps) {
  const props = node.properties as Node3DProperties;
  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(props),
    [props]
  );
  const visible = props.visible !== false;
  return (
    <group
      name={node.name}
      position={position}
      rotation={rotation}
      scale={scale}
      visible={visible}
    >
      {children}
    </group>
  );
}

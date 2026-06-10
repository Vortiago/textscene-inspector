/**
 * <AnimationPlayer> — non-rendered node that owns animation clip data.
 *
 * AnimationPlayer has no 3D representation in the viewport. The component
 * renders an empty group so the node appears correctly in the scene tree
 * and its children (if any) still receive their transforms. The details
 * panel surfaces clip names and playback configuration via the registered
 * propertyFormatter.
 */

import { useMemo } from 'react';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../r3f/nodeTransform';
import type { AnimationPlayerProperties } from './types';

export function AnimationPlayer({ node, children }: NodeComponentProps) {
  const properties = node.properties as AnimationPlayerProperties;

  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );

  return (
    <group
      name={node.name}
      position={position}
      rotation={rotation}
      scale={scale}
      userData={{ nodeType: 'AnimationPlayer' }}
    >
      {children}
    </group>
  );
}

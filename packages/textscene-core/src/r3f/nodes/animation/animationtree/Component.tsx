/**
 * <AnimationTree> — non-rendered node that drives blended animation playback.
 *
 * AnimationTree has no 3D representation in the viewport. The component
 * renders an empty group so the node appears correctly in the scene tree
 * and its children (if any) receive their transforms. The details panel
 * surfaces tree configuration via the registered propertyFormatter.
 */

import { useMemo } from 'react';
import type { NodeComponentProps } from '../../../NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../nodeTransform';
import type { AnimationTreeProperties } from '../../../../nodes/animation/animationtree/types';

export function AnimationTree({ node, children }: NodeComponentProps) {
  const properties = node.properties as AnimationTreeProperties;

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
      userData={{ nodeType: 'AnimationTree' }}
    >
      {children}
    </group>
  );
}

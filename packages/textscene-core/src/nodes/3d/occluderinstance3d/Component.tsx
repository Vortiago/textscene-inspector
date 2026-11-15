/**
 * <OccluderInstance3D> draws nothing (ADR-0008). Its selection box is the `get_aabb` of its
 * occluder (`occluder_instance_3d.cpp:427-432`).
 */

import { useMemo } from 'react';
import { EMPTY_AABB } from '../../../godot/math/aabb';
import { occluderAabb } from '../../../godot/scene/occluder';
import { NodeAabb } from '../../../r3f/components/NodeAabb';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { useNodeResource } from '../../../resources/reading';
import { Node3D } from '../../base/node3d/Component';
import { OCCLUDER_3D } from './kind';
import type { OccluderInstance3DProperties } from './types';

export function OccluderInstance3D({ node, children }: NodeComponentProps) {
  const { occluder } = node.properties as OccluderInstance3DProperties;
  const shape = useNodeResource(occluder, OCCLUDER_3D).value;
  const aabb = useMemo(() => (shape ? occluderAabb(shape) : EMPTY_AABB), [shape]);
  return (
    <Node3D node={node}>
      <NodeAabb aabb={aabb} />
      {children}
    </Node3D>
  );
}

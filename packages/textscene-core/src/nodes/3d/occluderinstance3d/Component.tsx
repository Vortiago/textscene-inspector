/**
 * <OccluderInstance3D> draws nothing (ADR-0008). Its selection box is the `get_aabb` of its
 * occluder (`occluder_instance_3d.cpp:427-432`).
 */

import { useMemo } from 'react';
import { EMPTY_AABB } from '../../../godot/math/aabb';
import { occluderAabb } from '../../../godot/scene/occluder';
import { NodeAabb } from '../../../r3f/components/NodeAabb';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useSubOrExtResource } from '../../../resources/useSubOrExtResource';
import { Node3D } from '../../base/node3d/Component';
import { decodeOccluder } from './decodeOccluder';
import type { OccluderInstance3DProperties } from './types';

export function OccluderInstance3D({ node, children }: NodeComponentProps) {
  const { occluder } = node.properties as OccluderInstance3DProperties;
  const scoped = useSubOrExtResource(occluder, useSceneResources());
  const aabb = useMemo(() => {
    const shape = scoped ? decodeOccluder(scoped.resource) : null;
    return shape ? occluderAabb(shape) : EMPTY_AABB;
  }, [scoped]);
  return (
    <Node3D node={node}>
      <NodeAabb aabb={aabb} />
      {children}
    </Node3D>
  );
}

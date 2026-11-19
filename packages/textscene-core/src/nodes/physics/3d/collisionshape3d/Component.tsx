import { useMemo } from 'react';
import type { CollisionShape3DProperties } from './types';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { node3dGroupSpread, transformFromNode3DProperties } from '../../../../r3f/nodeTransform';
import { useNodeResource } from '../../../../resources/reading';
import { SHAPE_3D } from '../../../../resources/shapes/shape3d';
import { useViewShow } from '../../../../r3f/viewShow/ViewShowContext';
import { CollisionGizmo } from './CollisionGizmo';
import { useGodotLinearColor } from '../../../../r3f/godotColor';
import { DEFAULT_COLLISION_DEBUG_COLOR } from '../../shared/debugColor';

export function CollisionShape3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as CollisionShape3DProperties;
  const { collisions: showCollisions } = useViewShow();

  const transform = useMemo(() => transformFromNode3DProperties(properties), [properties]);

  const shape = useNodeResource(properties.shape, SHAPE_3D).value;
  // Godot draws the shape in the node's own `debug_color`. The literal is sRGB.
  const debugColor = useGodotLinearColor(properties.debugColor ?? DEFAULT_COLLISION_DEBUG_COLOR);

  return (
    <group name={node.name} {...node3dGroupSpread(transform)}>
      {showCollisions && shape ? <CollisionGizmo shape={shape} color={debugColor} /> : null}
      {children}
    </group>
  );
}

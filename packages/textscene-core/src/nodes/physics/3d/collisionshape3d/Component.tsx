/**
 * <CollisionShape3D>: a transform-only node whose collision-shape resource draws as a wireframe
 * gizmo (ADR-0005 / ADR-0006). The gizmo shows only while `ViewportModeContext.showCollisions`
 * is on (off by default), like Godot's "Visible Collision Shapes".
 */

import { useMemo } from 'react';
import type { CollisionShape3DProperties } from './types';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { node3dGroupSpread, transformFromNode3DProperties } from '../../../../r3f/nodeTransform';
import { useNodeResource } from '../../../../resources/reading';
import { SHAPE_3D } from '../../../../resources/shapes/shape3d';
import { useViewportMode } from '../../../../r3f/contexts/ViewportModeContext';
import { CollisionGizmo } from './CollisionGizmo';
import { useGodotLinearColor } from '../../../../r3f/godotColor';
import { DEFAULT_COLLISION_DEBUG_COLOR } from '../../shared/debugColor';

export function CollisionShape3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as CollisionShape3DProperties;
  const { showCollisions } = useViewportMode();

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

/**
 * <CollisionShape3D> — a transform-only node whose collision-shape resource is
 * drawn as a toggleable wireframe gizmo (ADR-0005 / ADR-0006). The gizmo is
 * hidden unless `ViewportModeContext.showCollisions` is on (off by default),
 * mirroring Godot's "Visible Collision Shapes".
 */

import { useMemo } from 'react';
import type { CollisionShape3DProperties } from './types';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../../r3f/nodeTransform';
import { useSceneResources } from '../../../../r3f/SceneResourcesContext';
import { useSubOrExtResource } from '../../../../resources/useSubOrExtResource';
import { useViewportMode } from '../../../../r3f/contexts/ViewportModeContext';
import { CollisionGizmo } from './CollisionGizmo';
import { useGodotLinearColor } from '../../../../r3f/godotColor';
import { DEFAULT_COLLISION_DEBUG_COLOR } from '../../shared/debugColor';

export function CollisionShape3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as CollisionShape3DProperties;
  const { internalResources, externalResources } = useSceneResources();
  const { showCollisions } = useViewportMode();

  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );

  const shapeResource = useSubOrExtResource(properties.shape, internalResources, externalResources);
  // Godot draws the shape in the node's own `debug_color`; the literal is sRGB.
  const debugColor = useGodotLinearColor(properties.debugColor ?? DEFAULT_COLLISION_DEBUG_COLOR);

  return (
    <group name={node.name} position={position} rotation={rotation} scale={scale}>
      {showCollisions && shapeResource ? (
        <CollisionGizmo shape={shapeResource} color={debugColor} />
      ) : null}
      {children}
    </group>
  );
}

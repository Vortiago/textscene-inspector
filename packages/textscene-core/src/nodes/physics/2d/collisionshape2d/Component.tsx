/**
 * <CollisionShape2D> — a transform-only Node2D node whose collision-shape
 * resource is drawn as a toggleable outline gizmo (mirrors CollisionShape3D,
 * ADR-0005/ADR-0006). The gizmo is hidden unless `ViewportModeContext.
 * showCollisions` is on (off by default), matching Godot's "Visible
 * Collision Shapes".
 */

import type { CollisionShape2DProperties } from './types';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../../r3f/components/CanvasItem2D';
import { useSceneResources } from '../../../../r3f/SceneResourcesContext';
import { useSubOrExtResource } from '../../../../resources/useSubOrExtResource';
import { useViewportMode } from '../../../../r3f/contexts/ViewportModeContext';
import { CollisionGizmo2D } from './CollisionGizmo2D';
import { useGodotLinearColor } from '../../../../r3f/godotColor';
import { DEFAULT_COLLISION_DEBUG_COLOR } from '../../shared/debugColor';

export function CollisionShape2D({ node, children }: NodeComponentProps) {
  const properties = node.properties as CollisionShape2DProperties;
  const { internalResources, externalResources } = useSceneResources();
  const { showCollisions } = useViewportMode();

  const shapeResource = useSubOrExtResource(properties.shape, internalResources, externalResources);
  // Godot draws the shape in the node's own `debug_color`; the literal is sRGB.
  const debugColor = useGodotLinearColor(properties.debugColor ?? DEFAULT_COLLISION_DEBUG_COLOR);

  return (
    <CanvasItem2D
      node={node}
      props={properties}
      body={() =>
        showCollisions && shapeResource ? (
          <CollisionGizmo2D shape={shapeResource} color={debugColor} />
        ) : null
      }
    >
      {children}
    </CanvasItem2D>
  );
}

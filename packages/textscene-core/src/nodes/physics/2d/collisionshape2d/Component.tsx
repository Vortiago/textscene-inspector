/**
 * <CollisionShape2D> — a transform-only Node2D node whose collision-shape
 * resource is drawn as a toggleable outline gizmo (mirrors CollisionShape3D,
 * ADR-0005/ADR-0006). The gizmo is hidden unless `ViewportModeContext.
 * showCollisions` is on (off by default), matching Godot's "Visible
 * Collision Shapes".
 */

import { useMemo } from 'react';
import type { CollisionShape2DProperties } from './types';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../../r3f/components/CanvasItem2D';
import { useSceneResources } from '../../../../r3f/SceneResourcesContext';
import { resolveSubResourceRef } from '../../../../resources/SubResourceResolver';
import { useViewportMode } from '../../../../r3f/contexts/ViewportModeContext';
import { CollisionGizmo2D } from './CollisionGizmo2D';

export function CollisionShape2D({ node, children }: NodeComponentProps) {
  const properties = node.properties as CollisionShape2DProperties;
  const { internalResources } = useSceneResources();
  const { showCollisions } = useViewportMode();

  const shapeResource = useMemo(
    () => resolveSubResourceRef(properties.shape, internalResources),
    [properties.shape, internalResources]
  );

  return (
    <CanvasItem2D
      node={node}
      props={properties}
      body={() => (showCollisions && shapeResource ? <CollisionGizmo2D shape={shapeResource} /> : null)}
    >
      {children}
    </CanvasItem2D>
  );
}

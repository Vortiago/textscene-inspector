/**
 * <CollisionShape3D> — a transform-only node whose collision-shape resource is
 * drawn as a toggleable wireframe gizmo (ADR-0005 / ADR-0006). The gizmo is
 * hidden unless `ViewportModeContext.showCollisions` is on (off by default),
 * mirroring Godot's "Visible Collision Shapes".
 */

import { useMemo } from 'react';
import type { CollisionShape3DProperties } from './types';
import type { TscnInternalResource } from '../../../../parser/types';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../../r3f/nodeTransform';
import { findSubResource, useSceneResources } from '../../../../r3f/SceneResourcesContext';
import { parseResourceReference } from '../../../../resources/SubResourceResolver';
import { useViewportMode } from '../../../../r3f/contexts/ViewportModeContext';
import { CollisionGizmo } from './CollisionGizmo';

export function CollisionShape3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as CollisionShape3DProperties;
  const { internalResources } = useSceneResources();
  const { showCollisions } = useViewportMode();

  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );

  const shapeResource = useMemo(
    () => resolveShape(properties.shape, internalResources),
    [properties.shape, internalResources]
  );

  return (
    <group name={node.name} position={position} rotation={rotation} scale={scale}>
      {showCollisions && shapeResource ? <CollisionGizmo shape={shapeResource} /> : null}
      {children}
    </group>
  );
}

function resolveShape(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): TscnInternalResource | undefined {
  if (!ref) return undefined;
  const parsed = parseResourceReference(ref);
  if (!parsed || parsed.type !== 'SubResource') return undefined;
  return findSubResource(internalResources, parsed.id);
}

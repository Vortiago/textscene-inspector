/**
 * Resolve a CollisionShape2D/3D `shape` property to the resource the gizmo
 * draws, whichever of the two forms the scene uses:
 *
 *   `SubResource("id")` — an inline `[sub_resource]` block, resolved synchronously
 *   `ExtResource("id")` — a standalone `.tres`, loaded through the resource
 *                         pipeline and adapted to the same `{ type, data }` shape
 *
 * `resolveSubResourceRef` alone returns undefined for the ExtResource form, so
 * those shapes drew no gizmo at all and logged nothing (three vendored physics
 * scenes reference `godot3_robot_head_collision.tres` that way).
 */

import { useMemo } from 'react';
import type { TscnExternalResource, TscnInternalResource } from '../../parser/types';
import type { ParsedTresFile } from '../../parser/tresParser';
import { resolveExtResourcePath, resolveSubResourceRef } from '../SubResourceResolver';
import { useResource } from '../useResource';

export function useShapeResource(
  shapeRef: string | undefined,
  internalResources: readonly TscnInternalResource[],
  externalResources: readonly TscnExternalResource[]
): TscnInternalResource | undefined {
  const inline = useMemo(
    () => resolveSubResourceRef(shapeRef, internalResources),
    [shapeRef, internalResources]
  );

  // Called unconditionally with '' when the shape is inline or absent (rules of
  // hooks); '' short-circuits to pending inside the hook.
  const externalPath = useMemo(
    () => (inline ? null : resolveExtResourcePath(shapeRef, externalResources)),
    [inline, shapeRef, externalResources]
  );
  const external = useResource<ParsedTresFile>(externalPath ?? '', 'Resource');

  return useMemo(() => {
    if (inline) return inline;
    const tres = external.value;
    if (!externalPath || !tres) return undefined;
    return { id: externalPath, type: tres.resourceType, data: tres.properties };
  }, [inline, external.value, externalPath]);
}

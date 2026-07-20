/**
 * Resolve a resource-valued property to its `{ type, data }` regardless of which
 * of the two forms the scene uses:
 *
 *   `SubResource("id")` — an inline `[sub_resource]` block, resolved synchronously
 *   `ExtResource("id")` — a standalone `.tres`, loaded through the resource
 *                         pipeline and adapted to the same shape
 *
 * Either resolver alone silently drops half the scenes in the wild: a
 * CollisionShape whose `shape` is a `.tres` drew no gizmo (three vendored
 * physics scenes reference `godot3_robot_head_collision.tres` that way), and a
 * NavigationRegion whose polygon is inline drew no navmesh.
 */

import { useMemo } from 'react';
import type { TscnExternalResource, TscnInternalResource } from '../parser/types';
import type { ParsedTresFile } from '../parser/tresParser';
import { resolveExtResourcePath, resolveSubResourceRef } from './SubResourceResolver';
import { useResource } from './useResource';

export function useSubOrExtResource(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[],
  externalResources: readonly TscnExternalResource[]
): TscnInternalResource | undefined {
  const inline = useMemo(
    () => resolveSubResourceRef(ref, internalResources),
    [ref, internalResources]
  );

  // Called unconditionally with '' when the shape is inline or absent (rules of
  // hooks); '' short-circuits to pending inside the hook.
  const externalPath = useMemo(
    () => (inline ? null : resolveExtResourcePath(ref, externalResources)),
    [inline, ref, externalResources]
  );
  const external = useResource<ParsedTresFile>(externalPath ?? '', 'Resource');

  return useMemo(() => {
    if (inline) return inline;
    const tres = external.value;
    if (!externalPath || !tres) return undefined;
    return { id: externalPath, type: tres.resourceType, data: tres.properties };
  }, [inline, external.value, externalPath]);
}

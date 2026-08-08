/**
 * Where a material a node points at actually lives, and how to render it.
 *
 * A `material` / `material_override` / `surface_material_override/N` reference is
 * one of two unrelated things: a `[sub_resource]` of the previewed `.tscn`, which
 * the renderer already holds and no resource path can address, or an
 * `ExtResource` naming a `.tres` the pipeline has to fetch. The two need
 * different slot components (`StandardMaterialSlot` vs `ExternalMaterialSlot`),
 * so the choice is made once here and the caller just switches on `kind`.
 *
 * An unresolvable reference comes back `undefined` — the same fall-through Godot
 * takes when the RID is invalid.
 */

import type { TscnExternalResource, TscnInternalResource } from '../../parser/types';
import { parseResourceReference } from '../../resources/SubResourceResolver';
import { findSubResource } from '../SceneResourcesContext';

export type MaterialSource =
  /** A StandardMaterial3D `[sub_resource]` of the previewed scene. */
  | { kind: 'scene'; resource: TscnInternalResource }
  /** A `res://` path the material pipeline loads. */
  | { kind: 'path'; path: string };

export function resolveMaterialSource(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[],
  externalResources: readonly TscnExternalResource[]
): MaterialSource | undefined {
  if (!ref) return undefined;
  const parsed = parseResourceReference(ref);
  if (!parsed) return undefined;

  if (parsed.type === 'SubResource') {
    const resource = findSubResource(internalResources, parsed.id);
    if (!resource || resource.type !== 'StandardMaterial3D') return undefined;
    return { kind: 'scene', resource };
  }

  const ext = externalResources.find((r) => r.id === parsed.id);
  // Only a `.tres` is a material document; an ExtResource material reference to
  // anything else is a form the pipeline has no builder for.
  if (!ext?.path || !ext.path.endsWith('.tres')) return undefined;
  return { kind: 'path', path: ext.path };
}

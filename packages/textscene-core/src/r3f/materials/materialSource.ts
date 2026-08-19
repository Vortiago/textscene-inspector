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
 * The ONE place that choice is made. Every node type holding a material
 * reference — MeshInstance3D's own slot and its two override properties, the CSG
 * primitives, a CSG root's per-surface slots — reads this, because Godot models
 * none of them differently: every one of those setters takes a `Ref<Material>`,
 * and where that resource was loaded from is not represented past the call.
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
  // Only a `.tres` is a material document, which is exactly what the pipeline
  // that would load it accepts (`standardmaterial3d/loadMaterial.ts`'s
  // `isMaterialPath`). Minting an address it must refuse buys a guaranteed-failed
  // load and the same default surface this returns.
  if (!ext?.path || !ext.path.endsWith('.tres')) return undefined;
  return { kind: 'path', path: ext.path };
}

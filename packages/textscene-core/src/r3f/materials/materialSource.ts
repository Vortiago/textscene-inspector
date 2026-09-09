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
import { warn } from '../../logger';
import { parseResourceReference } from '../../resources/SubResourceResolver';
import { findSubResource } from '../SceneResourcesContext';

export type MaterialSource =
  /** A StandardMaterial3D `[sub_resource]` of the previewed scene. */
  | { kind: 'scene'; resource: TscnInternalResource }
  /** A `res://` path the material pipeline loads. */
  | { kind: 'path'; path: string }
  /**
   * The slot names a Material this previewer cannot build — Godot's default 3D
   * surface (ADR-0041).
   *
   * Distinct from `undefined`, which means the slot names NO material: a node
   * with an empty slot keeps whatever it already had (a glTF surface its own
   * import gave it), while one whose override resolved to this had its material
   * REPLACED, and Godot draws the replacement.
   */
  | { kind: 'default' };

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
    if (resource?.type === 'ShaderMaterial') {
      // Declined rather than decoded: a ShaderMaterial's body has none of the
      // keys the StandardMaterial3D decode reads, so parsing it would yield a
      // default-constructed material — white and matte — where the surface
      // should be the one Godot binds for a mesh with no usable material. The
      // `.tres` arrival draws that same surface and says so; this is the other
      // half of saying so (ADR-0041). Repeats per reparse, where the `.tres`
      // side warns once — the loader caches what it built, and a scene body has
      // no such cache.
      warn("[material] ShaderMaterial is not compiled — rendering Godot's default 3D surface.");
      return { kind: 'default' };
    }
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

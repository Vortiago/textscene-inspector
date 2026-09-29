/**
 * Where a node's material lives. A material reference names a scene `[sub_resource]`
 * or an `ExtResource` `.tres`, and `useMaterial` loads either into the same shape, so
 * no slot renders differently for the file a material came from. Every node type with
 * a material reference reads this one choice, since each Godot setter takes a
 * `Ref<Material>` whatever its origin.
 */

import type { TscnExternalResource, TscnInternalResource } from '../../parser/types';
import { findExtResource, parseResourceReference } from '../../resources/SubResourceResolver';
import { BUILDABLE_MATERIAL_TYPES } from '../../resources/materials/buildableMaterialTypes';
import { findSubResource } from '../SceneResourcesContext';

/** A material body and the resource tables its references resolve in: its owning file's. */
export interface MaterialResource {
  resource: TscnInternalResource;
  internalResources: readonly TscnInternalResource[];
  externalResources: readonly TscnExternalResource[];
}

export type MaterialSource =
  /** A material the scene already holds, with the scene's tables. */
  | { kind: 'inline'; material: MaterialResource }
  /** A `.tres` file, or a `file.tres::SubId` address into one, that `useMaterial` loads. */
  | { kind: 'file'; path: string };

/**
 * The source `ref` names, or undefined when it names no material. Undefined leaves the
 * slot empty, as Godot's invalid RID does, so an override that names nothing keeps what
 * the surface had. A material this previewer cannot build still fills the slot, and
 * `useMaterial` answers with Godot's default surface for it (ADR-0041).
 */
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
    if (!resource || !BUILDABLE_MATERIAL_TYPES.has(resource.type)) return undefined;
    return { kind: 'inline', material: { resource, internalResources, externalResources } };
  }

  const ext = findExtResource(externalResources, parsed.id);
  // Only a `.tres` is a material document. Minting an address the loader must refuse
  // buys a guaranteed-failed load and the same default surface this returns.
  if (!ext?.path || !ext.path.endsWith('.tres')) return undefined;
  return { kind: 'file', path: ext.path };
}

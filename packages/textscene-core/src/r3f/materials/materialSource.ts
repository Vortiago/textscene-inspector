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
import { resourceFilePath } from '../../resources/subResourcePath';
import { findSubResource, type SceneResources } from '../SceneResourcesContext';

const RES_PATH = 'res://';

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
 * The source `ref` names, or undefined when it names no material. `ref` is a reference in the
 * scene's tables, or a `res://` path such as a material inside a mesh `.tres`. Undefined leaves the
 * slot empty, as Godot's invalid RID does, so an override that names nothing keeps what
 * the surface had. A material this previewer cannot build still fills the slot, and
 * `useMaterial` answers with Godot's default surface for it (ADR-0041).
 */
export function resolveMaterialSource(
  ref: string | undefined,
  { internalResources, externalResources }: SceneResources
): MaterialSource | undefined {
  if (!ref) return undefined;
  if (ref.startsWith(RES_PATH)) return fileMaterialSource(ref);
  const parsed = parseResourceReference(ref);
  if (!parsed) return undefined;

  if (parsed.type === 'SubResource') {
    const resource = findSubResource(internalResources, parsed.id);
    if (!resource || !BUILDABLE_MATERIAL_TYPES.has(resource.type)) return undefined;
    return { kind: 'inline', material: { resource, internalResources, externalResources } };
  }

  const ext = findExtResource(externalResources, parsed.id);
  return ext?.path ? fileMaterialSource(ext.path) : undefined;
}

/** One source per entry of an ArrayMesh's `materialPaths`. A null path is Godot's default surface. */
export function fileMaterialSources(
  materialPaths: readonly (string | null)[]
): (MaterialSource | undefined)[] {
  return materialPaths.map((path) => (path ? fileMaterialSource(path) : undefined));
}

/**
 * The source for a material file, or undefined for one that is no `.tres` document.
 * Minting an address the loader must refuse buys a failed load and the same default surface.
 */
function fileMaterialSource(path: string): MaterialSource | undefined {
  return resourceFilePath(path).endsWith('.tres') ? { kind: 'file', path } : undefined;
}

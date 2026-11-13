/**
 * Where a node's material lives. A material reference names a scene `[sub_resource]`
 * or an `ExtResource` resource file, and `useMaterial` loads either into the same shape, so
 * no slot renders differently for the file a material came from. Every node type with
 * a material reference reads this one choice, since each Godot setter takes a
 * `Ref<Material>` whatever its origin.
 */

import type { TscnExternalResource, TscnInternalResource } from '../../parser/types';
import {
  findExtResource,
  isResourceFilePath,
  parseResourceReference,
} from '../../resources/SubResourceResolver';
import { BUILDABLE_MATERIAL_TYPES } from '../../resources/materials/buildableMaterialTypes';
import { RES_SCHEME } from '../../resources/resPath';
import { resourceFilePath } from '../../resources/subResourcePath';
import { findSubResource, type SceneResources } from '../SceneResourcesContext';

/** A material body and the resource tables its references resolve in: its owning file's. */
export interface MaterialResource {
  resource: TscnInternalResource;
  internalResources: readonly TscnInternalResource[];
  externalResources: readonly TscnExternalResource[];
  /**
   * The address the tables live in, set when `useMaterial` loads a file: the file's own
   * `res://` path. Undefined for the scene's own tables, whose ids are unique within the
   * scene. A chain's visited key holds it, so two files' inline ids of one name cannot
   * collide.
   */
  origin?: string;
  /**
   * False when a resource between the node and the material, such as the mesh that holds a
   * surface's material, is not local to scene. Absent when every one is, as for the node's property.
   */
  isHeldLocally?: false;
}

/** The material's `isHeldLocally`, present only when false. */
type Held = Pick<MaterialResource, 'isHeldLocally'>;

export type MaterialSource =
  /** A material the scene already holds, with the scene's tables. */
  | ({ kind: 'inline'; material: MaterialResource } & Held)
  /** A resource file, or a `file.res::SubId` address into one, that `useMaterial` loads. */
  | ({ kind: 'file'; path: string } & Held);

/**
 * The source `ref` names, or undefined when it names no material. `ref` is a reference in the
 * scene's tables, or a `res://` path such as a material inside a mesh resource file. Undefined leaves the
 * slot empty, as Godot's invalid RID does, so an override that names nothing keeps what
 * the surface had. A material this previewer cannot build still fills the slot, and
 * `useMaterial` answers with Godot's default surface for it (ADR-0041). `isHeldLocally` is the
 * material's, as `MaterialResource` names it.
 */
export function resolveMaterialSource(
  ref: string | undefined,
  { internalResources, externalResources }: SceneResources,
  isHeldLocally = true,
  origin?: string
): MaterialSource | undefined {
  if (!ref) return undefined;
  if (ref.startsWith(RES_SCHEME)) return fileMaterialSource(ref, isHeldLocally);
  const parsed = parseResourceReference(ref);
  if (!parsed) return undefined;

  if (parsed.type === 'SubResource') {
    const resource = findSubResource(internalResources, parsed.id);
    if (!resource || !BUILDABLE_MATERIAL_TYPES.has(resource.type)) return undefined;
    return {
      kind: 'inline',
      material: { resource, internalResources, externalResources, origin },
      ...held(isHeldLocally),
    };
  }

  const ext = findExtResource(externalResources, parsed.id);
  return ext?.path ? fileMaterialSource(ext.path, isHeldLocally) : undefined;
}

/**
 * One source per entry of an ArrayMesh's `materialPaths`, held as `isHeldLocally` says, as in
 * `resolveMaterialSource`. A null path is Godot's default surface.
 */
export function fileMaterialSources(
  materialPaths: readonly (string | null)[],
  isHeldLocally = true
): (MaterialSource | undefined)[] {
  return materialPaths.map((path) => (path ? fileMaterialSource(path, isHeldLocally) : undefined));
}

/**
 * The source for a material file, or undefined for a path that is no resource file.
 * Minting an address the loader must refuse buys a failed load and the same default surface.
 */
function fileMaterialSource(path: string, isHeldLocally: boolean): MaterialSource | undefined {
  return isResourceFilePath(resourceFilePath(path))
    ? { kind: 'file', path, ...held(isHeldLocally) }
    : undefined;
}

export function held(isHeldLocally: boolean): Held {
  return isHeldLocally ? {} : { isHeldLocally };
}

/**
 * One link of the material's `next_pass` chain, as
 * `render_forward_clustered.cpp:4189`'s `while` walk reads each link: the reference
 * resolves in the tables of the file the material is written in, and its own
 * `isHeldLocally` carries over, so the link's textures resolve in the file that owns it.
 * Undefined ends the chain, as the loop's `!material` guard does.
 *
 * @canonical One link of a material's next_pass chain
 */
export function resolveNextPass(
  nextPass: string | undefined,
  material: MaterialResource
): MaterialSource | undefined {
  const { internalResources, externalResources, isHeldLocally, origin } = material;
  return resolveMaterialSource(
    nextPass,
    { internalResources, externalResources },
    isHeldLocally ?? true,
    // The link resolves in the same file's tables, so it keys by that file too.
    origin
  );
}

/**
 * The identity a visited set holds a chain source by: an inline material's resource id,
 * a file source's path. Prefixed, so an inline id and a path cannot collide. Godot
 * refuses a cyclic chain at the setter (`material.cpp:39-42`), so only a hand-written
 * file can produce one, and the renderer cuts it with this key.
 *
 * @canonical The visited-set key of a material source
 */
export function materialSourceKey(source: MaterialSource): string {
  return source.kind === 'inline'
    ? `inline:${source.material.origin ?? 'scene'}:${source.material.resource.id}`
    : `file:${source.path}`;
}

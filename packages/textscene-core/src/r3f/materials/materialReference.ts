/**
 * Where a surface's material lives: a reference that `useMaterial` reads with the `MATERIAL` kind,
 * whether it names a scene `[sub_resource]`, an `ExtResource` or a `res://` address. Every node
 * type with a material property reads this one choice, since each Godot setter takes a
 * `Ref<Material>` whatever its origin.
 */

import { nodeReference, referenceHeldBy, type ScopedReference } from '../../resources/reading';
import { NO_RESOURCES, type SceneResources } from '../SceneResourcesContext';

/**
 * `ref`, a material property of the node that `scope` wrote. Undefined when it names nothing,
 * as Godot's invalid RID does, so the slot keeps what the surface had.
 */
export function nodeMaterial(ref: string | undefined, scope: SceneResources): ScopedReference | undefined {
  return ref ? nodeReference(ref, scope) : undefined;
}

/** A `res://` material address a node holds as its own, such as an importer's remap of a surface. */
export function fileMaterial(path: string): ScopedReference {
  return nodeReference(path, NO_RESOURCES);
}

/**
 * `ref`, a material slot of a mesh, resolved in the tables of the file that holds the mesh.
 * `isHeldLocally` is false when the mesh, or a holder above it, is not local to scene.
 */
export function heldMaterial(
  ref: string | null | undefined,
  resources: SceneResources,
  isHeldLocally: boolean
): ScopedReference | undefined {
  return ref ? referenceHeldBy(ref, resources, isHeldLocally) : undefined;
}

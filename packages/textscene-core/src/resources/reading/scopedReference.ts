/**
 * A reference on its way to a read: the literal, the tables it resolves in, and how it has been
 * held so far. Godot keeps two origin facts past the load, the file whose tables a nested
 * reference resolves in and `resource_local_to_scene` along the chain of holders, and this value
 * carries both. No THREE and no React.
 */

import type { SceneResources } from '../../r3f/SceneResourcesContext';
import { parseResourceReference, resolveExtResourcePath } from '../SubResourceResolver';
import { subResourcePath } from '../subResourcePath';

export interface ScopedReference {
  /** `SubResource("id")`, `ExtResource("id")` or a `res://` address. Undefined names nothing. */
  readonly ref: string | undefined;
  /** The tables `ref` resolves in. */
  readonly resources: SceneResources;
  /** The `res://` file the tables belong to. Undefined for the scene's own tables. */
  readonly origin?: string;
  /** False once a holder passed on the way is not local to scene. */
  readonly isHeldLocally: boolean;
}

/**
 * A node's own property, resolved in the tables of the file that wrote the node (ADR-0051).
 * `make_local_resource` sets the property's own resource up (`packed_scene.cpp:701-704`), so the
 * node holds it locally.
 */
export function nodeReference(ref: string | undefined, scope: SceneResources): ScopedReference {
  return referenceHeldBy(ref, scope, true);
}

/**
 * `ref` in the tables of the resource that holds it, with no origin: a material slot, a
 * StyleBoxTexture, a TileSet source, a SpriteFrames frame. `isHeldLocally` is false when a holder
 * on the way is not local to scene. The source scan lists each caller.
 */
export function referenceHeldBy(
  ref: string | undefined,
  resources: SceneResources,
  isHeldLocally: boolean
): ScopedReference {
  return { ref, resources, isHeldLocally };
}

/** Whether two references name the same resource, held the same way. */
export function sameReference(a: ScopedReference | null, b: ScopedReference | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.ref === b.ref &&
    a.resources === b.resources &&
    a.origin === b.origin &&
    a.isHeldLocally === b.isHeldLocally
  );
}

/**
 * The visited-set and memo key of a reference: the address of a file, or the origin and the id
 * of a SubResource, so one id in two files gives two keys.
 */
export function referenceKey(reference: ScopedReference): string {
  const { ref, origin = '' } = reference;
  const parsed = ref === undefined ? null : parseResourceReference(ref);
  if (parsed?.type === 'SubResource') return subResourcePath(origin, parsed.id);
  return resolveExtResourcePath(ref, reference.resources.externalResources) ?? `${origin}?${ref ?? ''}`;
}

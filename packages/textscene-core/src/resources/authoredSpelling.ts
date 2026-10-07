/**
 * A value spelled as its own file wrote it. Override re-homing renames an id the target scope
 * already holds, for example to `ExtResource("3 (outer)")`. Godot keeps one table per file
 * and shows no rename, so the inspector spells each reference with the copy's `authoredId`.
 */
import { renameResourceRefs } from '../godot/resourceRef.js';
import type { SceneScope } from '../parser/types.js';
import { findExtResource, findSubResource } from './SubResourceResolver.js';

/** `text` with each reference that `scope` holds as a renamed copy spelled with its authored id. */
export function authoredSpelling(text: string, scope: SceneScope): string {
  return renameResourceRefs(text, (ref) => {
    const resource =
      ref.kind === 'ExtResource'
        ? findExtResource(scope.externalResources, ref.id)
        : findSubResource(scope.internalResources, ref.id);
    return resource?.authoredId ?? ref.id;
  });
}

/** Whether `scope` holds a copy that re-homing renamed, so a value can read differently. */
export function holdsRenamedCopy(scope: SceneScope): boolean {
  const isRenamed = (r: { id: string; authoredId?: string }) =>
    r.authoredId !== undefined && r.authoredId !== r.id;
  return scope.externalResources.some(isRenamed) || scope.internalResources.some(isRenamed);
}

/** Resolves a reference to a resource without a hook, against the files already loaded. */

import type { TscnInternalResource } from '../parser/types';
import type { SceneResources } from '../r3f/SceneResourcesContext';
import { scopedSection } from './resourceSection';
import type { LoadedFile, ScopedResource } from './scopedResource';
import { parsedResourcePath, resolveSubResourceRef } from './SubResourceResolver';

/** The file `ref` loads from, or null for a SubResource, no reference, or a path no processor reads. */
export function referencedFilePath(ref: string | undefined, pools: SceneResources): string | null {
  return parsedResourcePath(ref, pools.externalResources);
}

/** {@link resolveReference}, for a caller that needs only the resource and not its tables. */
export function resolveReferencedResource(
  ref: string | undefined,
  pools: SceneResources,
  loadedFile: LoadedFile
): TscnInternalResource | null {
  return resolveReference(ref, pools, loadedFile)?.resource ?? null;
}

/**
 * The resource `ref` names in `pools`: a SubResource in the tables, or the section of the loaded
 * file an ExtResource names, scoped to that file's own tables. Null for no reference, an unknown
 * id, or a file not loaded yet.
 */
export function resolveReference(
  ref: string | undefined,
  pools: SceneResources,
  loadedFile: LoadedFile
): ScopedResource | null {
  const inline = resolveSubResourceRef(ref, pools.internalResources);
  if (inline) return { resource: inline, resources: pools };
  const path = referencedFilePath(ref, pools);
  const parsed = path ? loadedFile(path) : undefined;
  return (path && parsed && scopedSection(parsed, path)) || null;
}

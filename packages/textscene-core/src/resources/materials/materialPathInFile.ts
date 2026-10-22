/**
 * A material reference inside a `.tres`, resolved in that file: an `ExtResource` to its own file, a
 * `SubResource` to a **Sub-resource path** (`filePath::id`). Null for no reference, an undeclared
 * id, or a sub-resource no material builder reads. `resources` are the file's own tables.
 */

import type { SceneResources } from '../../r3f/SceneResourcesContext.js';
import { extResourcePathsById, resolveRefToResourcePath, subResourceTypeGate } from '../subResourcePath.js';
import { BUILDABLE_MATERIAL_TYPES } from './buildableMaterialTypes.js';

export function materialPathInFile(
  ref: string | undefined,
  resources: SceneResources,
  filePath: string
): string | null {
  return resolveRefToResourcePath(
    ref,
    extResourcePathsById(resources.externalResources),
    filePath,
    subResourceTypeGate(resources.internalResources, BUILDABLE_MATERIAL_TYPES)
  );
}

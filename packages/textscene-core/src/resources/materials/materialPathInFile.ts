/**
 * A material reference inside a `.tres`, resolved in that file: an `ExtResource` to its own file, a
 * `SubResource` to a **Sub-resource path** (`filePath::id`). Null for no reference, an undeclared
 * id, or a sub-resource no material builder reads.
 */

import type { TscnExternalResource, TscnInternalResource } from '../../parser/types.js';
import { extResourcePathsById, resolveRefToResourcePath, subResourceTypeGate } from '../subResourcePath.js';
import { BUILDABLE_MATERIAL_TYPES } from './buildableMaterialTypes.js';

export function materialPathInFile(
  ref: string | undefined,
  file: { extResources: readonly TscnExternalResource[]; subResources: readonly TscnInternalResource[] },
  filePath: string
): string | null {
  return resolveRefToResourcePath(
    ref,
    extResourcePathsById(file.extResources),
    filePath,
    subResourceTypeGate(file.subResources, BUILDABLE_MATERIAL_TYPES)
  );
}

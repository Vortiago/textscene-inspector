/** The MultiMesh a scene resource holds, decoded once per change of its content. */

import { warn } from '../../../logger.js';
import { resourceContentKey } from '../../resourceContentKey.js';
import type { ScopedResource } from '../../scopedResource.js';
import { useContentMemo } from '../../useContentMemo.js';
import { decodeMultiMesh } from './decode.js';
import type { DecodedMultiMesh } from './types.js';

/** A MultiMesh reads no file, so its own content is the whole key. */
function ownContentKey({ resource }: ScopedResource): string {
  return resourceContentKey(resource);
}

/** The MultiMesh a bag holds, or null for another type or a packed array this cannot read. */
function readMultiMesh({ resource }: ScopedResource): DecodedMultiMesh | null {
  if (resource.type !== 'MultiMesh') return null;
  try {
    return decodeMultiMesh(resource.data);
  } catch (error) {
    warn(`[MultiMesh] unreadable: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * `scoped` as a decoded MultiMesh, or null for none, another type or a MultiMesh this cannot read.
 * The same object while the content holds.
 */
export function useMultiMeshData(scoped: ScopedResource | null): DecodedMultiMesh | null {
  return useContentMemo(scoped, ownContentKey, readMultiMesh);
}

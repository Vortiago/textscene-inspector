/** The MultiMesh a scene resource holds, decoded once per change of its content. */

import { warn } from '../../../logger.js';
import { resourceContentKey } from '../../resourceContentKey.js';
import type { ScopedResource } from '../../scopedResource.js';
import { useContentMemo } from '../../useContentMemo.js';
import { NO_RESOURCES, useSceneResources, type SceneResources } from '../../../r3f/SceneResourcesContext.js';
import { useSubOrExtResource } from '../../useSubOrExtResource.js';
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
function useMultiMeshData(scoped: ScopedResource | null): DecodedMultiMesh | null {
  return useContentMemo(scoped, ownContentKey, readMultiMesh);
}

/** The MultiMesh a node references, and the tables its own `mesh` reference resolves in. */
export interface ReferencedMultiMesh {
  multiMesh: DecodedMultiMesh | null;
  /** The MultiMesh's own tables, which a file's MultiMesh keeps apart from the scene's. */
  resources: SceneResources;
}

/** The MultiMesh `ref` names in the scene's resources, as {@link useMultiMeshData} decodes it. */
export function useReferencedMultiMesh(ref: string | undefined): ReferencedMultiMesh {
  const scoped = useSubOrExtResource(ref, useSceneResources());
  return { multiMesh: useMultiMeshData(scoped), resources: scoped?.resources ?? NO_RESOURCES };
}

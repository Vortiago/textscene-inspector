/**
 * Registers the PackedScene ExtResource an instance ref names, then loads the
 * scene. The viewport's instanced node and the outliner's sub-scene rows share it.
 */
import { useEffect } from 'react';
import type { TscnExternalResource, TscnScene } from '../../parser/types.js';
import { useResource, useResourceLoader, type ResourceResult } from '../../resources/useResource.js';
import { findExtResource, parseResourceReference } from '../../resources/SubResourceResolver.js';

/**
 * A null `loadPath` registers and loads nothing, and the result stays `pending`.
 * The caller resolves it from `instanceRef`, and nulls it for a scene it refuses.
 */
export function useInstancedScene(
  instanceRef: string,
  externalResources: readonly TscnExternalResource[],
  loadPath: string | null
): ResourceResult<TscnScene> {
  const loader = useResourceLoader();

  // Ahead of `useResource`: a component runs its effects in order. The load checks
  // the registered type, and the loader reports a failed load only for a
  // registered path. Idempotent.
  useEffect(() => {
    if (!loader || !loadPath) return;
    const parsed = parseResourceReference(instanceRef);
    if (parsed?.type !== 'ExtResource') return;
    const ext = findExtResource(externalResources, parsed.id);
    if (ext) loader.register(ext);
  }, [loader, loadPath, instanceRef, externalResources]);

  // `useResource` requests nothing for '', so the hook count stays stable.
  return useResource<TscnScene>(loadPath ?? '', 'scene');
}

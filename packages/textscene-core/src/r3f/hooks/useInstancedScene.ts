/**
 * Registers the PackedScene ExtResource an instance ref names, then loads the
 * scene. The viewport's instanced node and the outliner's sub-scene rows share it.
 */
import { useEffect } from 'react';
import type { TscnExternalResource, TscnScene } from '../../parser/types.js';
import { useResource, useResourceLoader, type ResourceResult } from '../../resources/useResource.js';
import { registerInstanceResource } from '../../resources/registerInstanceResource.js';
import { useLoadFailure } from '../../resources/loadFailure/useLoadFailure.js';

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

  // Ahead of `useResource`, since a component runs its effects in order and the
  // load checks the registered type. Idempotent.
  useEffect(() => {
    if (loader && loadPath) registerInstanceResource(loader, instanceRef, externalResources);
  }, [loader, loadPath, instanceRef, externalResources]);

  // `useResource` requests nothing for '', so the hook count stays stable.
  const scene = useResource<TscnScene>(loadPath ?? '', 'scene');
  const failure = useLoadFailure(loadPath);
  return failure ? failedScene(failure.chain) : scene;
}

/** Godot drops the instance of a scene it fails to load, as one of a missing scene. */
function failedScene(chain: readonly string[]): ResourceResult<TscnScene> {
  return { value: undefined, status: 'unavailable', error: `fails to load through ${chain.join(', ')}` };
}

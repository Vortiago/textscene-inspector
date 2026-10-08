/**
 * A resource-valued property as its property bag with the pools its own references resolve
 * against: a `SubResource("id")` with the scene's, or an external `.tres` with the file's own,
 * whose ids are scoped to that file.
 */

import { useMemo } from 'react';
import type { ParsedResource } from '../parser/parsedResource';
import type { TscnInternalResource } from '../parser/types';
import { useSceneResources, type SceneResources } from '../r3f/SceneResourcesContext';
import { resolveExtResourcePath, resolveSubResourceRef } from './SubResourceResolver';
import { useResource } from './useResource';

export interface ScopedResource {
  resource: TscnInternalResource;
  /** The pools the resource's own references resolve against. */
  resources: SceneResources;
}

/** The resource `ref` names, or null while it is none, still loading or unreadable. */
export function useScopedResource(ref: string | undefined): ScopedResource | null {
  const scene = useSceneResources();
  const inline = resolveSubResourceRef(ref, scene.internalResources);
  const path = inline ? null : resolveExtResourcePath(ref, scene.externalResources);
  // Only a text resource parses: no processor reads a binary `.res`. `''` requests nothing.
  const tresPath = path?.endsWith('.tres') ? path : null;
  const file = useResource<ParsedResource>(tresPath ?? '', 'resource').value;

  return useMemo(() => {
    if (inline) return { resource: inline, resources: scene };
    if (!tresPath || !file) return null;
    return {
      resource: { id: tresPath, type: file.resourceType, data: file.properties },
      resources: { internalResources: file.subResources, externalResources: file.extResources },
    };
  }, [inline, scene, tresPath, file]);
}

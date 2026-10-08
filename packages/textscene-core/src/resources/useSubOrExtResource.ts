/**
 * A resource-valued property as its property bag with the pools its own references resolve
 * against. A `SubResource("id")` resolves synchronously against `pools`. An `ExtResource("id")`
 * loads its `.tres` through the resource pipeline and resolves against the file's own pools, whose
 * ids are scoped to that file.
 */

import { useMemo } from 'react';
import type { ParsedResource } from '../parser/parsedResource';
import type { TscnInternalResource } from '../parser/types';
import type { SceneResources } from '../r3f/SceneResourcesContext';
import { resolveExtResourcePath, resolveSubResourceRef } from './SubResourceResolver';
import { useResource, type ResourceStatus } from './useResource';

export interface ScopedResource {
  resource: TscnInternalResource;
  /** The pools the resource's own references resolve against. */
  resources: SceneResources;
}

/** The resource `ref` names in `pools`, with whether it has loaded. */
export interface ResourceResolution {
  /** Null while the resource is none, still loading or unreadable. */
  scoped: ScopedResource | null;
  status: ResourceStatus;
}

const UNAVAILABLE: ResourceResolution = { scoped: null, status: 'unavailable' };
const PENDING: ResourceResolution = { scoped: null, status: 'pending' };

export function useResourceResolution(ref: string | undefined, pools: SceneResources): ResourceResolution {
  const inline = resolveSubResourceRef(ref, pools.internalResources);
  const path = inline ? null : resolveExtResourcePath(ref, pools.externalResources);
  // Only a text resource parses: no processor reads a binary `.res`. `''` requests nothing.
  const tresPath = path?.endsWith('.tres') ? path : null;
  const file = useResource<ParsedResource>(tresPath ?? '', 'resource');

  return useMemo(() => {
    if (inline) return { scoped: { resource: inline, resources: pools }, status: 'loaded' };
    if (!tresPath) return UNAVAILABLE;
    if (file.status === 'pending') return PENDING;
    if (!file.value) return UNAVAILABLE;
    const { resourceType, properties, subResources, extResources } = file.value;
    return {
      scoped: {
        resource: { id: tresPath, type: resourceType, data: properties },
        resources: { internalResources: subResources, externalResources: extResources },
      },
      status: 'loaded',
    };
  }, [inline, pools, tresPath, file.status, file.value]);
}

/** The resource `ref` names in `pools`, or null while it is none, still loading or unreadable. */
export function useSubOrExtResource(ref: string | undefined, pools: SceneResources): ScopedResource | null {
  return useResourceResolution(ref, pools).scoped;
}

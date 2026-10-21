/**
 * A resource-valued property as its property bag with the pools its own references resolve
 * against. A `SubResource("id")` resolves synchronously against `pools`. An `ExtResource("id")`
 * loads its file through the resource pipeline and resolves against the file's own pools, whose
 * ids are scoped to that file.
 */

import { useMemo } from 'react';
import type { ParsedResource } from '../parser/parsedResource';
import type { TscnInternalResource } from '../parser/types';
import type { SceneResources } from '../r3f/SceneResourcesContext';
import { resolveSubResourceRef, parsedResourcePath } from './SubResourceResolver';
import { useResource, type ResourceStatus } from './useResource';
import { scopedSection } from './resourceSection';
import { resourceFilePath } from './subResourcePath';

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
  /** The path the resource loads from, a file or a **Sub-resource path**, or null for a SubResource or none. */
  resourcePath: string | null;
}

const UNAVAILABLE: ResourceResolution = { scoped: null, status: 'unavailable', resourcePath: null };

export function useResourceResolution(ref: string | undefined, pools: SceneResources): ResourceResolution {
  const inline = resolveSubResourceRef(ref, pools.internalResources);
  const fileResolution = usePathResolution(inline ? null : parsedResourcePath(ref, pools.externalResources));
  const inlineResolution = useMemo(
    (): ResourceResolution | null =>
      inline
        ? { scoped: { resource: inline, resources: pools }, status: 'loaded', resourcePath: null }
        : null,
    [inline, pools]
  );
  return inlineResolution ?? fileResolution;
}

/**
 * The resource `path` addresses, a file's `[resource]` body or a **Sub-resource path**'s
 * `[sub_resource]`, resolved against that file's own tables. Unavailable for no path, and for an id
 * the file does not declare.
 */
export function usePathResolution(path: string | null): ResourceResolution {
  // `''` requests nothing.
  const file = useResource<ParsedResource>(path ? resourceFilePath(path) : '', 'resource');
  // Apart from any scene tables: a scene edit leaves the file's resource the same object while the file holds.
  return useMemo((): ResourceResolution => {
    if (!path) return UNAVAILABLE;
    if (!file.value) {
      return {
        scoped: null,
        status: file.status === 'pending' ? 'pending' : 'unavailable',
        resourcePath: path,
      };
    }
    const scoped = scopedSection(file.value, path);
    if (!scoped) return { scoped: null, status: 'unavailable', resourcePath: path };
    return { scoped, status: 'loaded', resourcePath: path };
  }, [path, file.status, file.value]);
}

/** The resource `ref` names in `pools`, or null while it is none, still loading or unreadable. */
export function useSubOrExtResource(ref: string | undefined, pools: SceneResources): ScopedResource | null {
  return useResourceResolution(ref, pools).scoped;
}

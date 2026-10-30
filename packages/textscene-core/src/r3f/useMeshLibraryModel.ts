/**
 * Resolve a GridMap's `mesh_library` reference (`ExtResource("…")` or `res://…`)
 * into a MeshLibraryModel, loading the `.tres` through `useResource`. With nothing
 * to load it passes `''`, so the hook-call count is constant.
 */

import { useMemo } from 'react';
import type { ParsedResource } from '../parser/parsedResource';
import type { TscnInternalResource } from '../parser/types';
import { parsedResourcePath } from '../resources/SubResourceResolver';
import { meshLibraryFromTres } from '../resources/meshlibrary/decode';
import { findSectionResource } from '../resources/resourceSection';
import type { MeshLibraryModel } from '../resources/meshlibrary/types';
import { useResource } from '../resources/useResource';
import { useSceneResources } from './SceneResourcesContext';

interface MeshLibraryModelResult {
  model: MeshLibraryModel | null;
  /** The library's `[resource]`, the first holder of each item's mesh. Null until it loads. */
  resource: TscnInternalResource | null;
  status: 'pending' | 'loaded' | 'unavailable';
}

export function useMeshLibraryModel(meshLibraryRef: string | undefined): MeshLibraryModelResult {
  const { externalResources } = useSceneResources();

  const resourcePath = parsedResourcePath(meshLibraryRef, externalResources);
  const resourceFile = useResource<ParsedResource>(resourcePath ?? '', 'resource');

  return useMemo((): MeshLibraryModelResult => {
    if (!meshLibraryRef || !resourcePath) return { model: null, resource: null, status: 'unavailable' };
    if (resourceFile.status === 'pending') return { model: null, resource: null, status: 'pending' };
    if (resourceFile.status === 'unavailable' || !resourceFile.value) {
      return { model: null, resource: null, status: 'unavailable' };
    }
    // The library's own path goes in so an item mesh it embeds as a
    // `[sub_resource]` comes back as an addressable path like any other.
    return {
      model: meshLibraryFromTres(resourceFile.value, resourcePath),
      resource: findSectionResource(resourceFile.value, resourcePath) ?? null,
      status: 'loaded',
    };
  }, [meshLibraryRef, resourcePath, resourceFile.status, resourceFile.value]);
}

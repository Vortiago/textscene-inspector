/**
 * useMeshLibraryModel — resolves a GridMap's `mesh_library` reference into a
 * MeshLibraryModel. GridMaps reference an external MeshLibrary `.tres`
 * (`ExtResource("…")` / `res://…`), fetched via useResource('Resource') and
 * parsed against the file's own ext sections. Hook-call count is constant: the
 * no-request idiom feeds `''` to useResource when there's nothing to load.
 */

import { useMemo } from 'react';
import type { ParsedResource } from '../parser/parsedResource';
import { resolveExtResourcePath } from '../resources/SubResourceResolver';
import { meshLibraryFromTres } from '../resources/meshlibrary/decode';
import type { MeshLibraryModel } from '../resources/meshlibrary/types';
import { useResource } from '../resources/useResource';
import { useSceneResources } from './SceneResourcesContext';

export interface MeshLibraryModelResult {
  model: MeshLibraryModel | null;
  status: 'pending' | 'loaded' | 'unavailable';
}

export function useMeshLibraryModel(meshLibraryRef: string | undefined): MeshLibraryModelResult {
  const { externalResources } = useSceneResources();

  const resolvedPath = meshLibraryRef
    ? resolveExtResourcePath(meshLibraryRef, externalResources)
    : null;
  // Only text resources parse; a binary `.res` MeshLibrary would park forever.
  const tresPath = resolvedPath?.endsWith('.tres') ? resolvedPath : null;
  const tresResult = useResource<ParsedResource>(tresPath ?? '', 'Resource');

  return useMemo((): MeshLibraryModelResult => {
    if (!meshLibraryRef || !tresPath) return { model: null, status: 'unavailable' };
    if (tresResult.status === 'pending') return { model: null, status: 'pending' };
    if (tresResult.status === 'unavailable' || !tresResult.value) {
      return { model: null, status: 'unavailable' };
    }
    // The library's own path goes in so an item mesh it embeds as a
    // `[sub_resource]` comes back as an addressable path like any other.
    return { model: meshLibraryFromTres(tresResult.value, tresPath), status: 'loaded' };
  }, [meshLibraryRef, tresPath, tresResult.status, tresResult.value]);
}

/**
 * Resolve a GridMap's `mesh_library` reference (`ExtResource("…")` or `res://…`)
 * into a MeshLibraryModel, loading the `.tres` through `useResource`. With nothing
 * to load it passes `''`, so the hook-call count is constant.
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
  // Only a text resource parses. A binary `.res` MeshLibrary would park forever.
  const tresPath = resolvedPath?.endsWith('.tres') ? resolvedPath : null;
  const tresResult = useResource<ParsedResource>(tresPath ?? '', 'resource');

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

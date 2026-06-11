/**
 * useTileSetModel — resolves a tile node's `tile_set` reference into the
 * normalized TileSetModel, from either home a TileSet lives in:
 *   - `SubResource("…")` — embedded in the scene; resolved synchronously
 *     against the scene's internal/external resources (never `pending`).
 *   - `ExtResource("…")` / `res://…` — an external .tres file; fetched via
 *     useResource('Resource') (the generic .tres processor) and resolved
 *     against the file's own ext/sub sections. Missing-file panel rows and
 *     late-arrival upload recovery come from useResource.
 *
 * Hook-call count is constant: the sync branches feed `''` to useResource
 * (the documented no-request idiom).
 */

import { useMemo } from 'react';
import type { ParsedTresFile } from '../parser/tresParser';
import { parseResourceReference, resolveExtResourcePath } from '../resources/SubResourceResolver';
import { tileSetFromScene, tileSetFromTres } from '../resources/tileset/resolveTileSet';
import type { TileSetModel } from '../resources/tileset/tileSetModel';
import { useResource } from '../resources/useResource';
import { useSceneResources } from './SceneResourcesContext';

export interface TileSetModelResult {
  model: TileSetModel | null;
  status: 'pending' | 'loaded' | 'unavailable';
}

export function useTileSetModel(tileSetRef: string | undefined): TileSetModelResult {
  const { internalResources, externalResources } = useSceneResources();

  const ref = tileSetRef ? parseResourceReference(tileSetRef) : null;
  const isExternal = !!tileSetRef && (ref?.type === 'ExtResource' || tileSetRef.startsWith('res://'));
  const tresPath = isExternal ? resolveExtResourcePath(tileSetRef, externalResources) : null;
  const tresResult = useResource<ParsedTresFile>(tresPath ?? '', 'Resource');

  return useMemo((): TileSetModelResult => {
    if (!tileSetRef) return { model: null, status: 'unavailable' };

    if (ref?.type === 'SubResource') {
      const model = tileSetFromScene(tileSetRef, internalResources, externalResources);
      return model ? { model, status: 'loaded' } : { model: null, status: 'unavailable' };
    }

    if (!tresPath) return { model: null, status: 'unavailable' };
    if (tresResult.status === 'pending') return { model: null, status: 'pending' };
    if (tresResult.status === 'unavailable' || !tresResult.value) {
      return { model: null, status: 'unavailable' };
    }
    const model = tileSetFromTres(tresResult.value);
    return model ? { model, status: 'loaded' } : { model: null, status: 'unavailable' };
  }, [tileSetRef, ref?.type, internalResources, externalResources, tresPath, tresResult.status, tresResult.value]);
}

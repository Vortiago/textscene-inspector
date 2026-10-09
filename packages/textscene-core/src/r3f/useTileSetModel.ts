/**
 * Resolve a tile node's `tile_set` into the normalised TileSetModel. A
 * `SubResource("…")` resolves synchronously, never `pending`. An `ExtResource("…")`
 * or `res://…` .tres loads through `useResource`, with its missing-file and upload
 * handling. The sync branches pass `''`, so the hook-call count is constant.
 */

import { useMemo } from 'react';
import { warn } from '../logger';
import type { ParsedResource } from '../parser/parsedResource';
import { parseResourceReference, resolveExtResourcePath } from '../resources/SubResourceResolver';
import { tileSetFromScene, tileSetFromTres } from '../resources/tileset/decode';
import type { TileSetModel } from '../resources/tileset/types';
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
  const resolvedPath = isExternal ? resolveExtResourcePath(tileSetRef, externalResources) : null;
  // Only a text resource parses. No processor handles a binary `.res` TileSet,
  // so requesting one would park the load in flight.
  const tresPath = resolvedPath?.endsWith('.tres') ? resolvedPath : null;
  const tresResult = useResource<ParsedResource>(tresPath ?? '', 'resource');

  return useMemo((): TileSetModelResult => {
    if (!tileSetRef) return { model: null, status: 'unavailable' };

    if (ref?.type === 'SubResource') {
      const model = tileSetFromScene(tileSetRef, internalResources, externalResources);
      return model ? { model, status: 'loaded' } : { model: null, status: 'unavailable' };
    }

    if (resolvedPath && !tresPath) {
      warn(`[TileSet] "${resolvedPath}" is not a text resource (.tres) — cannot resolve TileSet`);
      return { model: null, status: 'unavailable' };
    }
    if (!tresPath) return { model: null, status: 'unavailable' };
    if (tresResult.status === 'pending') return { model: null, status: 'pending' };
    if (tresResult.status === 'unavailable' || !tresResult.value) {
      return { model: null, status: 'unavailable' };
    }
    const model = tileSetFromTres(tresResult.value);
    return model ? { model, status: 'loaded' } : { model: null, status: 'unavailable' };
  }, [
    tileSetRef,
    ref?.type,
    internalResources,
    externalResources,
    resolvedPath,
    tresPath,
    tresResult.status,
    tresResult.value,
  ]);
}

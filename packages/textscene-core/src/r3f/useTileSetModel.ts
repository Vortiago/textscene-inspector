/**
 * Resolve a tile node's `tile_set` into the normalised TileSetModel. A
 * `SubResource("…")` resolves synchronously, never `pending`. An `ExtResource("…")`
 * or `res://…` resource file loads through `useResource`, with its missing-file and upload
 * handling. The sync branches pass `''`, so the hook-call count is constant.
 */

import { useMemo } from 'react';
import { warn } from '../logger';
import type { ParsedResource } from '../parser/parsedResource';
import {
  isResourceFilePath,
  parseResourceReference,
  resolveExtResourcePath,
} from '../resources/SubResourceResolver';
import { tileSetFromScene, tileSetFromFile } from '../resources/tileset/decode';
import type { TileSetModel } from '../resources/tileset/types';
import { useResource } from '../resources/useResource';
import { useSceneResources } from './SceneResourcesContext';

interface TileSetModelResult {
  model: TileSetModel | null;
  status: 'pending' | 'loaded' | 'unavailable';
}

export function useTileSetModel(tileSetRef: string | undefined): TileSetModelResult {
  const { internalResources, externalResources } = useSceneResources();

  const ref = tileSetRef ? parseResourceReference(tileSetRef) : null;
  const isExternal = !!tileSetRef && (ref?.type === 'ExtResource' || tileSetRef.startsWith('res://'));
  const resolvedPath = isExternal ? resolveExtResourcePath(tileSetRef, externalResources) : null;
  // Only a resource file parses. Requesting any other path would park the load in flight.
  const filePath = resolvedPath && isResourceFilePath(resolvedPath) ? resolvedPath : null;
  const fileResult = useResource<ParsedResource>(filePath ?? '', 'resource');

  return useMemo((): TileSetModelResult => {
    if (!tileSetRef) return { model: null, status: 'unavailable' };

    if (ref?.type === 'SubResource') {
      const model = tileSetFromScene(tileSetRef, internalResources, externalResources);
      return model ? { model, status: 'loaded' } : { model: null, status: 'unavailable' };
    }

    if (resolvedPath && !filePath) {
      warn(`[TileSet] "${resolvedPath}" is not a resource file: cannot resolve TileSet`);
      return { model: null, status: 'unavailable' };
    }
    if (!filePath) return { model: null, status: 'unavailable' };
    if (fileResult.status === 'pending') return { model: null, status: 'pending' };
    if (fileResult.status === 'unavailable' || !fileResult.value) {
      return { model: null, status: 'unavailable' };
    }
    const model = tileSetFromFile(fileResult.value);
    return model ? { model, status: 'loaded' } : { model: null, status: 'unavailable' };
  }, [
    tileSetRef,
    ref?.type,
    internalResources,
    externalResources,
    resolvedPath,
    filePath,
    fileResult.status,
    fileResult.value,
  ]);
}

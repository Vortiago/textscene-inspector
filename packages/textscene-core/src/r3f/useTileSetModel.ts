/**
 * Resolve a tile node's `tile_set` into the normalised TileSetModel. A
 * `SubResource("…")` resolves synchronously, never `pending`. An `ExtResource("…")`
 * or `res://…` resource file loads through `useResource`, with its missing-file and upload
 * handling. The sync branches pass `''`, so the hook-call count is constant.
 */

import { useCallback, useMemo } from 'react';
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
import { useLoadedFiles } from '../resources/useLoadedFiles';
import { atlasTextureFiles, withTilesSizedAtLoad } from '../resources/tileset/sizedAtLoad';
import { useSceneResources } from './SceneResourcesContext';

interface TileSetModelResult {
  model: TileSetModel | null;
  status: 'pending' | 'loaded' | 'unavailable';
}

/** The TileSet `tileSetRef` names, with the tiles Godot creates once its atlas textures size it. */
export function useTileSetModel(tileSetRef: string | undefined): TileSetModelResult {
  const decoded = useDecodedTileSet(tileSetRef);
  const { model } = decoded;
  const planFiles = useCallback(() => (model ? atlasTextureFiles(model) : []), [model]);
  const { loadedFile, isLoading } = useLoadedFiles(planFiles);
  return useMemo((): TileSetModelResult => {
    if (!model) return decoded;
    if (isLoading) return { model: null, status: 'pending' };
    return { model: withTilesSizedAtLoad(model, loadedFile), status: decoded.status };
  }, [decoded, model, isLoading, loadedFile]);
}

function useDecodedTileSet(tileSetRef: string | undefined): TileSetModelResult {
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
    const model = tileSetFromFile(fileResult.value, filePath);
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

/**
 * Resolve a tile node's `tile_set` into the normalised TileSetModel, from the scene or from a
 * file, through the reading module's `TILE_SET` kind. A TileSet and its sources built into the
 * scene answer at once, with no pending frame. The read goes through the live files, which the
 * live tree reads the same TileSet through for its scene tiles: one load and one answer for both.
 */

import { useCallback, useMemo } from 'react';
import { warn } from '../logger';
import { nodeReference, type Read, type ResourceSnapshot } from '../resources/reading';
import { useSceneResources } from './SceneResourcesContext';
import { useLiveFilesRead } from './useLiveSceneTree';
import { TILE_SET } from '../resources/tileset/kind';
import type { TileSetModel } from '../resources/tileset/types';

export type TileSetStatus = 'pending' | 'loaded' | 'unavailable';

interface TileSetModelResult {
  model: TileSetModel | null;
  status: TileSetStatus;
}

const PENDING: TileSetModelResult = { model: null, status: 'pending' };
const UNAVAILABLE: TileSetModelResult = { model: null, status: 'unavailable' };

/** The TileSet `tileSetRef` names, with the tiles Godot creates once its atlas textures size it. */
export function useTileSetModel(tileSetRef: string | undefined): TileSetModelResult {
  const scope = useSceneResources();
  const readTileSet = useCallback(
    (snapshot: ResourceSnapshot) => snapshot.read(nodeReference(tileSetRef, scope), TILE_SET),
    [tileSetRef, scope]
  );
  const read = useLiveFilesRead(readTileSet, sameRead);
  return useMemo(() => resultOf(read, tileSetRef), [read, tileSetRef]);
}

function sameRead(a: Read<TileSetModel>, b: Read<TileSetModel>): boolean {
  if (a.status === 'unavailable' && b.status === 'unavailable') return a.reason === b.reason;
  return a.status === b.status && a.value === b.value;
}

function resultOf(read: Read<TileSetModel>, tileSetRef: string | undefined): TileSetModelResult {
  if (read.status === 'loaded') return { model: read.value, status: 'loaded' };
  if (read.status === 'pending') return PENDING;
  if (read.status === 'unavailable' && read.reason === 'wrong-type')
    warn(`[TileSet] "${tileSetRef}" names no TileSet: cannot resolve TileSet`);
  return UNAVAILABLE;
}

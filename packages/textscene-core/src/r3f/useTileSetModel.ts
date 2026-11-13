/**
 * Resolve a tile node's `tile_set` into the normalised TileSetModel, from the scene or from a
 * file, through the reading module's `TILE_SET` kind. A TileSet and its sources built into the
 * scene answer at once, with no pending frame.
 */

import { useMemo } from 'react';
import { warn } from '../logger';
import { useNodeResource, type Read } from '../resources/reading';
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
  const read = useNodeResource(tileSetRef, TILE_SET);
  return useMemo(() => resultOf(read, tileSetRef), [read, tileSetRef]);
}

function resultOf(read: Read<TileSetModel>, tileSetRef: string | undefined): TileSetModelResult {
  if (read.status === 'loaded') return { model: read.value, status: 'loaded' };
  if (read.status === 'pending') return PENDING;
  if (read.status === 'unavailable' && read.reason === 'wrong-type')
    warn(`[TileSet] "${tileSetRef}" names no TileSet: cannot resolve TileSet`);
  return UNAVAILABLE;
}

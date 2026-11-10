/**
 * The scene tile placeholder discs of each TileMap layer, tinted by the layer's own `modulate`
 * (a TileMap layer is a child canvas item of the TileMap, `scene/2d/tile_map.cpp`).
 */

import { useMemo } from 'react';
import { multiplyModulate } from '../../../../r3f/canvasItemModulate';
import type { Rgba } from '../../../../godot/math/math';
import type { SceneTileCell } from '../../../../resources/tileset/sceneTileCells';
import type { TileSetModel } from '../../../../resources/tileset/types';
import { ScenePlaceholders } from '../shared/ScenePlaceholders';
import type { TileMapLayerData } from './types';

interface LayerPlaceholdersProps {
  grid: TileSetModel;
  layers: readonly TileMapLayerData[];
  /** The placeholder tiles of every layer; a tile belongs to the layer whose cells hold its cell. */
  tiles: readonly SceneTileCell[];
  /** The TileMap's inherited modulate. */
  modulate: Rgba;
}

export function LayerPlaceholders({ grid, layers, tiles, modulate }: LayerPlaceholdersProps) {
  const tilesByLayer = useMemo(
    () =>
      layers.map((layer) => {
        const cells = new Set(layer.cells);
        return tiles.filter((tile) => cells.has(tile.cell));
      }),
    [layers, tiles]
  );
  return layers.map((layer, index) => (
    <ScenePlaceholders
      key={index}
      grid={grid}
      tiles={tilesByLayer[index]!}
      modulate={layer.modulate ? multiplyModulate(modulate, layer.modulate) : modulate}
    />
  ));
}

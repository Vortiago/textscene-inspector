/** The placeholder colour of a cell, read back from the discs a layer would draw. */
import { TileLayout, TileOffsetAxis, TileShape } from '../../godot/scene/tileSet';
import type { Rgba } from '../../godot/math/math';
import { placeholderCircles } from './scenePlaceholder';

export const PLACEHOLDER_TEST_GRID = {
  shape: TileShape.TILE_SHAPE_SQUARE,
  layout: TileLayout.TILE_LAYOUT_STACKED,
  offsetAxis: TileOffsetAxis.TILE_OFFSET_AXIS_HORIZONTAL,
  tileSize: { x: 64, y: 32 },
};

export function placeholderColorOf(sourceId: number, alternativeId: number): Rgba {
  const [circle] = placeholderCircles(PLACEHOLDER_TEST_GRID, [
    {
      cell: { coords: { x: 0, y: 0 }, sourceId, atlasCoords: { x: 0, y: 0 }, alternativeId },
      tile: { scene: null, displayPlaceholder: false },
    },
  ]);
  return circle!.color;
}
